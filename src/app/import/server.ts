"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dailyInspections, importJobs, inspections, transporters, vehicles } from "@/db/schema";
import { newId } from "@/lib/utils";
import { getCurrentUser, canImport } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const REQUIRED: Record<string, string[]> = {
  vehicles: ["registration_number", "make"],
  transporters: ["company_name"],
  inspections: ["registration_number", "inspection_date", "overall_result"],
  pre_trip_inspections: ["registration_number", "inspection_date", "pre_trip_result"],
};

const MAX_ROWS: Record<string, number> = {
  vehicles: 500,
  transporters: 500,
  inspections: 500,
  pre_trip_inspections: 5000,
};

type PreTripStatus = "passed" | "failed" | "defect_noted";

function mapRow(row: Record<string, string>, mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping)
      .filter(([, source]) => Boolean(source))
      .map(([target, source]) => [target, String(row[source] ?? "").trim()])
  );
}

function intOrNull(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value.replaceAll(",", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseImportDate(value?: string) {
  const raw = value?.trim();
  if (!raw) return null;

  let date: Date;
  const numeric = Number(raw);
  if (/^\d+(?:\.\d+)?$/.test(raw) && numeric >= 20000 && numeric <= 80000) {
    // Excel serial date (1900 date system, including the historical leap-year offset).
    date = new Date(Date.UTC(1899, 11, 30) + numeric * 86_400_000);
  } else {
    date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  }

  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 5 * 60_000) return null;
  return { date, dateOnly: date.toISOString().slice(0, 10) };
}

function normalizePreTripResult(value?: string): PreTripStatus | null {
  const normalized = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, PreTripStatus> = {
    pass: "passed",
    passed: "passed",
    safe: "passed",
    safe_to_load: "passed",
    safe_to_operate: "passed",
    cleared: "passed",
    cleared_for_trip: "passed",
    yes: "passed",
    fail: "failed",
    failed: "failed",
    unsafe: "failed",
    not_safe_to_load: "failed",
    not_safe_to_operate: "failed",
    grounded: "failed",
    no: "failed",
    defect: "defect_noted",
    defect_noted: "defect_noted",
    conditional: "defect_noted",
    monitor: "defect_noted",
  };

  return aliases[normalized] || null;
}

function boolOrNull(value?: string) {
  const normalized = (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!normalized) return null;
  if (["true", "yes", "y", "1", "safe", "safe_to_load", "cleared"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "unsafe", "not_safe_to_load", "grounded"].includes(normalized)) return false;
  return null;
}

function buildPreTripNotes(row: Record<string, string>) {
  const metadata: string[] = [];
  if (row.source_reference) metadata.push(`Import Ref: ${row.source_reference}`);
  if (row.product) metadata.push(`Product: ${row.product}`);
  if (row.capacity) metadata.push(`Capacity: ${row.capacity}`);
  if (row.transporter_name) metadata.push(`Transporter: ${row.transporter_name}`);

  const parts = [row.notes || "", metadata.length ? `Historical import metadata — ${metadata.join("; ")}` : "Historical Pre-Trip import"];
  return parts.filter(Boolean).join(" | ");
}

export async function submitImport(input: {
  fileName: string;
  fileType: string;
  entityType: string;
  rows: Record<string, string>[];
  mapping: Record<string, string>;
}) {
  const user = await getCurrentUser();
  if (!canImport(user)) throw new Error("Not authorised to import");
  if (!REQUIRED[input.entityType]) throw new Error("Unsupported import entity type");
  if (!input.fileName || input.fileName.length > 255) throw new Error("Invalid import filename");

  const maxRows = MAX_ROWS[input.entityType] || 500;
  if (!Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > maxRows) {
    throw new Error(`Import must contain 1 to ${maxRows.toLocaleString()} rows`);
  }

  const jobId = newId();
  const mappedRows = input.rows.map((row) => mapRow(row, input.mapping));
  const errors: { row: number; field: string; message: string }[] = [];
  let importedCount = 0;

  async function finishImport() {
    await db.insert(importJobs).values({
      id: jobId,
      fileName: input.fileName,
      fileType: input.fileType.slice(0, 20),
      entityType: input.entityType,
      status: importedCount > 0 ? "completed" : "failed",
      totalRows: mappedRows.length,
      validRows: importedCount,
      invalidRows: mappedRows.length - importedCount,
      importedRows: importedCount,
      columnMapping: input.mapping,
      errors: errors.slice(0, 200),
      createdBy: user.id,
      completedAt: new Date(),
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "import",
      entityType: input.entityType,
      entityId: jobId,
      entityLabel: input.fileName,
      summary: `Imported ${importedCount} of ${mappedRows.length} ${input.entityType} records`,
      after: { imported: importedCount, invalid: mappedRows.length - importedCount },
    });

    revalidatePath("/import");
    revalidatePath("/vehicles");
    revalidatePath("/transporters");
    revalidatePath("/inspections");
    revalidatePath("/daily-inspections");
    revalidatePath("/");
    return { imported: importedCount, invalid: mappedRows.length - importedCount, jobId };
  }

  if (input.entityType === "pre_trip_inspections") {
    const vehicleRows = await db.select({ id: vehicles.id, registrationNumber: vehicles.registrationNumber }).from(vehicles);
    const vehicleByRegistration = new Map(vehicleRows.map((vehicle) => [vehicle.registrationNumber.toUpperCase(), vehicle.id]));
    const seenSourceRefs = new Set<string>();
    const prepared: { rowNumber: number; value: typeof dailyInspections.$inferInsert }[] = [];

    for (let index = 0; index < mappedRows.length; index += 1) {
      const row = mappedRows[index];
      const rowNumber = index + 1;
      const missing = REQUIRED.pre_trip_inspections.filter((field) => !row[field]);
      if (missing.length) {
        for (const field of missing) errors.push({ row: rowNumber, field, message: "Required value is missing" });
        continue;
      }

      const registration = row.registration_number.toUpperCase();
      const vehicleId = vehicleByRegistration.get(registration);
      if (!vehicleId) {
        errors.push({ row: rowNumber, field: "registration_number", message: "Vehicle was not found" });
        continue;
      }

      const parsedDate = parseImportDate(row.inspection_date);
      if (!parsedDate) {
        errors.push({ row: rowNumber, field: "inspection_date", message: "Invalid or future inspection date" });
        continue;
      }

      const status = normalizePreTripResult(row.pre_trip_result);
      if (!status) {
        errors.push({ row: rowNumber, field: "pre_trip_result", message: "Use passed, failed, defect_noted, safe_to_load, or an equivalent value" });
        continue;
      }

      const clearanceOverride = boolOrNull(row.cleared_for_trip);
      if (row.cleared_for_trip && clearanceOverride === null) {
        errors.push({ row: rowNumber, field: "cleared_for_trip", message: "Use yes/no or true/false" });
        continue;
      }
      const clearedForTrip = clearanceOverride ?? status !== "failed";
      if ((status === "failed" && clearedForTrip) || (status === "passed" && !clearedForTrip)) {
        errors.push({ row: rowNumber, field: "cleared_for_trip", message: "Trip clearance conflicts with the Pre-Trip result" });
        continue;
      }

      const odometer = intOrNull(row.odometer);
      if (row.odometer && odometer === null) {
        errors.push({ row: rowNumber, field: "odometer", message: "Odometer must be a whole number" });
        continue;
      }

      if (row.source_reference) {
        const sourceKey = `${registration}|${parsedDate.dateOnly}|${row.source_reference.toLowerCase()}`;
        if (seenSourceRefs.has(sourceKey)) {
          errors.push({ row: rowNumber, field: "source_reference", message: "Duplicate source reference in this import" });
          continue;
        }
        seenSourceRefs.add(sourceKey);
      }

      const historicalTimestamp = new Date(`${parsedDate.dateOnly}T12:00:00.000Z`);
      prepared.push({
        rowNumber,
        value: {
          id: newId(),
          vehicleId,
          driverId: null,
          driverName: row.driver_name || "Historical import",
          inspectionDate: parsedDate.dateOnly,
          startTime: historicalTimestamp,
          completedAt: historicalTimestamp,
          odometer,
          tripPurpose: row.trip_purpose || (row.product ? `Load ${row.product}` : null),
          routeDescription: row.route_description || null,
          status,
          checklist: [],
          totalItems: 0,
          passedItems: 0,
          failedItems: 0,
          criticalDefects: [],
          driverSignature: null,
          clearedForTrip,
          notes: buildPreTripNotes(row),
        },
      });
    }

    const chunkSize = 250;
    for (let offset = 0; offset < prepared.length; offset += chunkSize) {
      const chunk = prepared.slice(offset, offset + chunkSize);
      try {
        await db.insert(dailyInspections).values(chunk.map((entry) => entry.value));
        importedCount += chunk.length;
      } catch {
        // Fall back to individual inserts only when a batch fails so row-level errors remain useful.
        for (const entry of chunk) {
          try {
            await db.insert(dailyInspections).values(entry.value);
            importedCount += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Database insert failed";
            errors.push({
              row: entry.rowNumber,
              field: "system",
              message: /unique|duplicate/i.test(message) ? "Duplicate record" : "Record could not be imported",
            });
          }
        }
      }
    }

    return finishImport();
  }

  for (let index = 0; index < mappedRows.length; index += 1) {
    const row = mappedRows[index];
    const rowNumber = index + 1;
    const missing = REQUIRED[input.entityType].filter((field) => !row[field]);
    if (missing.length) {
      for (const field of missing) errors.push({ row: rowNumber, field, message: "Required value is missing" });
      continue;
    }

    try {
      if (input.entityType === "vehicles") {
        const registration = row.registration_number.toUpperCase();
        const [existing] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.registrationNumber, registration));
        if (existing) {
          errors.push({ row: rowNumber, field: "registration_number", message: "Vehicle already exists" });
          continue;
        }

        let transporterId: string | null = null;
        if (row.transporter_name) {
          const [transporter] = await db.select({ id: transporters.id }).from(transporters).where(eq(transporters.companyName, row.transporter_name));
          if (!transporter) {
            errors.push({ row: rowNumber, field: "transporter_name", message: "Transporter was not found" });
            continue;
          }
          transporterId = transporter.id;
        }

        await db.insert(vehicles).values({
          id: newId(),
          transporterId,
          registrationNumber: registration,
          make: row.make,
          model: row.model || null,
          bodyType: row.body_type || null,
          category: row.category || null,
          vehicleClass: row.vehicle_class || null,
          colour: row.colour || null,
          manufacturingYear: intOrNull(row.manufacturing_year),
          vin: row.vin?.toUpperCase() || null,
          chassisNumber: row.chassis_number || null,
          engineNumber: row.engine_number || null,
          fuelType: (row.fuel_type || null) as any,
          transmission: (row.transmission || null) as any,
          seatingCapacity: intOrNull(row.seating_capacity),
          grossWeight: row.gross_weight || null,
          numberOfAxles: intOrNull(row.number_of_axles),
          odometerReading: intOrNull(row.odometer_reading),
          status: "active",
        });
        importedCount += 1;
      }

      if (input.entityType === "transporters") {
        const companyName = row.company_name;
        const [existing] = await db.select({ id: transporters.id }).from(transporters).where(eq(transporters.companyName, companyName));
        if (existing) {
          errors.push({ row: rowNumber, field: "company_name", message: "Transporter already exists" });
          continue;
        }
        await db.insert(transporters).values({
          id: newId(),
          companyName,
          registrationNumber: row.registration_number || null,
          tinNumber: row.tin_number || null,
          gpsAddress: row.gps_address || null,
          contactPerson: row.contact_person || null,
          mobile: row.mobile || null,
          email: row.email || null,
          physicalAddress: row.physical_address || null,
          region: row.region || null,
          district: row.district || null,
          insuranceCompany: row.insurance_company || null,
          insuranceExpiry: row.insurance_expiry || null,
        });
        importedCount += 1;
      }

      if (input.entityType === "inspections") {
        const registration = row.registration_number.toUpperCase();
        const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.registrationNumber, registration));
        if (!vehicle) {
          errors.push({ row: rowNumber, field: "registration_number", message: "Vehicle was not found" });
          continue;
        }
        const result = row.overall_result.toLowerCase();
        if (!["pass", "conditional_pass", "reinspection_required", "fail"].includes(result)) {
          errors.push({ row: rowNumber, field: "overall_result", message: "Invalid inspection result" });
          continue;
        }
        const parsedDate = parseImportDate(row.inspection_date);
        if (!parsedDate) {
          errors.push({ row: rowNumber, field: "inspection_date", message: "Invalid or future inspection date" });
          continue;
        }
        const id = newId();
        const number = row.inspection_number || `HIST-${parsedDate.dateOnly.replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
        const [duplicate] = await db.select({ id: inspections.id }).from(inspections).where(eq(inspections.inspectionNumber, number));
        if (duplicate) {
          errors.push({ row: rowNumber, field: "inspection_number", message: "Inspection number already exists" });
          continue;
        }
        await db.insert(inspections).values({
          id,
          inspectionNumber: number,
          vehicleId: vehicle.id,
          inspectionDate: parsedDate.date,
          inspectorName: row.inspector_name || "Historical import",
          station: row.station || "Historical record",
          workflowStatus: "archived",
          sectionData: [],
          overallResult: result as any,
          inspectorRemarks: row.inspector_remarks || null,
          nextInspectionDate: row.next_inspection_date || null,
          status: "historical_import",
        });
        importedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database insert failed";
      errors.push({ row: rowNumber, field: "system", message: /unique|duplicate/i.test(message) ? "Duplicate record" : "Record could not be imported" });
    }
  }

  return finishImport();
}
