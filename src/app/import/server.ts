"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dailyInspections, importJobs, inspections, transporters, vehicles } from "@/db/schema";
import { newId } from "@/lib/utils";
import { getCurrentUser, canImport } from "@/lib/auth";
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

const MAX_IMPORT_COLUMNS = 100;
const MAX_MAPPING_ENTRIES = 100;
const MAX_CELL_CHARS = 4000;
const MAX_IMPORT_FILENAME = 255;
const FUEL_TYPES = new Set(["petrol", "diesel", "electric", "hybrid", "cng", "lpg"]);
const TRANSMISSIONS = new Set(["manual", "automatic", "cvt", "semi-automatic"]);

type PreTripStatus = "passed" | "failed" | "defect_noted";
type ImportInput = {
  fileName: string;
  fileType: string;
  entityType: string;
  rows: Record<string, string>[];
  mapping: Record<string, string>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateImportEnvelope(input: ImportInput) {
  if (!isPlainRecord(input)) throw new Error("Invalid import request");
  if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > MAX_IMPORT_FILENAME || /[\u0000-\u001f\u007f]/.test(input.fileName)) {
    throw new Error("Invalid import filename");
  }
  if (typeof input.fileType !== "string" || input.fileType.length > 100) throw new Error("Invalid import file type");
  if (typeof input.entityType !== "string" || !REQUIRED[input.entityType]) throw new Error("Unsupported import entity type");
  if (!isPlainRecord(input.mapping)) throw new Error("Invalid column mapping");

  const mappingEntries = Object.entries(input.mapping);
  if (mappingEntries.length === 0 || mappingEntries.length > MAX_MAPPING_ENTRIES) {
    throw new Error(`Column mapping must contain 1 to ${MAX_MAPPING_ENTRIES} entries`);
  }
  for (const [target, source] of mappingEntries) {
    if (!target || target.length > 100 || typeof source !== "string" || source.length > 200) {
      throw new Error("Column mapping contains an invalid field");
    }
  }

  const maxRows = MAX_ROWS[input.entityType] || 500;
  if (!Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > maxRows) {
    throw new Error(`Import must contain 1 to ${maxRows.toLocaleString()} rows`);
  }

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index] as unknown;
    if (!isPlainRecord(row)) throw new Error(`Import row ${index + 1} is invalid`);
    const entries = Object.entries(row);
    if (entries.length > MAX_IMPORT_COLUMNS) throw new Error(`Import row ${index + 1} contains too many columns`);
    for (const [key, value] of entries) {
      if (!key || key.length > 200) throw new Error(`Import row ${index + 1} contains an invalid column name`);
      const text = value === null || value === undefined ? "" : String(value);
      if (text.length > MAX_CELL_CHARS) throw new Error(`Import row ${index + 1} contains a value longer than ${MAX_CELL_CHARS} characters`);
    }
  }
}

function mapRow(row: Record<string, string>, mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping)
      .filter(([, source]) => Boolean(source))
      .map(([target, source]) => [target, String(row[source] ?? "").trim()])
  );
}

function strictIntOrNull(value: string | undefined, min: number, max: number) {
  if (!value) return null;
  const normalized = value.replaceAll(",", "").trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseDateValue(value?: string, allowFuture = true) {
  const raw = value?.trim();
  if (!raw) return null;

  let date: Date;
  const numeric = Number(raw);
  if (/^\d+(?:\.\d+)?$/.test(raw) && numeric >= 20000 && numeric <= 80000) {
    date = new Date(Date.UTC(1899, 11, 30) + numeric * 86_400_000);
  } else {
    date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  }

  if (Number.isNaN(date.getTime())) return null;
  if (!allowFuture && date.getTime() > Date.now() + 5 * 60_000) return null;
  return { date, dateOnly: date.toISOString().slice(0, 10) };
}

function parseImportDate(value?: string) {
  return parseDateValue(value, false);
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
  return parts.filter(Boolean).join(" | ").slice(0, 4000);
}

function normalizedOptional(value: string | undefined, max: number) {
  const text = value?.trim();
  if (!text) return null;
  if (text.length > max) throw new Error("Imported value exceeds the supported field length");
  return text;
}

export async function submitImport(input: ImportInput) {
  const user = await getCurrentUser();
  if (!canImport(user)) throw new Error("Not authorised to import");
  validateImportEnvelope(input);

  const jobId = newId();
  const mappedRows = input.rows.map((row) => mapRow(row, input.mapping));
  const errors: { row: number; field: string; message: string }[] = [];
  let importedCount = 0;

  async function finishImport() {
    await db.insert(importJobs).values({
      id: jobId,
      fileName: input.fileName.trim(),
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
      if (registration.length > 50) {
        errors.push({ row: rowNumber, field: "registration_number", message: "Registration number is too long" });
        continue;
      }
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

      const odometer = strictIntOrNull(row.odometer, 0, 20_000_000);
      if (row.odometer && odometer === null) {
        errors.push({ row: rowNumber, field: "odometer", message: "Odometer must be a whole number between 0 and 20000000" });
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
          driverName: normalizedOptional(row.driver_name, 200) || "Historical import",
          inspectionDate: parsedDate.dateOnly,
          startTime: historicalTimestamp,
          completedAt: historicalTimestamp,
          odometer,
          tripPurpose: normalizedOptional(row.trip_purpose, 500) || (row.product ? `Load ${row.product.slice(0, 450)}` : null),
          routeDescription: normalizedOptional(row.route_description, 1000),
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

  const existingVehicleRegistrations = input.entityType === "vehicles"
    ? new Set((await db.select({ registrationNumber: vehicles.registrationNumber }).from(vehicles)).map((row) => row.registrationNumber.toUpperCase()))
    : new Set<string>();
  const transporterByName = input.entityType === "vehicles"
    ? new Map((await db.select({ id: transporters.id, companyName: transporters.companyName }).from(transporters)).map((row) => [row.companyName, row.id]))
    : new Map<string, string>();
  const existingTransporterNames = input.entityType === "transporters"
    ? new Set((await db.select({ companyName: transporters.companyName }).from(transporters)).map((row) => row.companyName))
    : new Set<string>();
  const vehicleByRegistration = input.entityType === "inspections"
    ? new Map((await db.select({ id: vehicles.id, registrationNumber: vehicles.registrationNumber }).from(vehicles)).map((row) => [row.registrationNumber.toUpperCase(), row.id]))
    : new Map<string, string>();
  const existingInspectionNumbers = input.entityType === "inspections"
    ? new Set((await db.select({ inspectionNumber: inspections.inspectionNumber }).from(inspections)).map((row) => row.inspectionNumber))
    : new Set<string>();

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
        if (registration.length < 2 || registration.length > 50) {
          errors.push({ row: rowNumber, field: "registration_number", message: "Registration number must contain 2 to 50 characters" });
          continue;
        }
        if (existingVehicleRegistrations.has(registration)) {
          errors.push({ row: rowNumber, field: "registration_number", message: "Vehicle already exists" });
          continue;
        }

        const make = normalizedOptional(row.make, 100);
        if (!make) {
          errors.push({ row: rowNumber, field: "make", message: "Vehicle make is required" });
          continue;
        }

        let transporterId: string | null = null;
        if (row.transporter_name) {
          transporterId = transporterByName.get(row.transporter_name) || null;
          if (!transporterId) {
            errors.push({ row: rowNumber, field: "transporter_name", message: "Transporter was not found" });
            continue;
          }
        }

        const manufacturingYear = strictIntOrNull(row.manufacturing_year, 1886, new Date().getFullYear() + 1);
        if (row.manufacturing_year && manufacturingYear === null) {
          errors.push({ row: rowNumber, field: "manufacturing_year", message: "Manufacturing year is invalid" });
          continue;
        }
        const seatingCapacity = strictIntOrNull(row.seating_capacity, 0, 500);
        if (row.seating_capacity && seatingCapacity === null) {
          errors.push({ row: rowNumber, field: "seating_capacity", message: "Seating capacity is invalid" });
          continue;
        }
        const numberOfAxles = strictIntOrNull(row.number_of_axles, 1, 20);
        if (row.number_of_axles && numberOfAxles === null) {
          errors.push({ row: rowNumber, field: "number_of_axles", message: "Number of axles is invalid" });
          continue;
        }
        const odometerReading = strictIntOrNull(row.odometer_reading, 0, 20_000_000);
        if (row.odometer_reading && odometerReading === null) {
          errors.push({ row: rowNumber, field: "odometer_reading", message: "Odometer reading is invalid" });
          continue;
        }
        const fuelType = row.fuel_type?.toLowerCase() || "";
        if (fuelType && !FUEL_TYPES.has(fuelType)) {
          errors.push({ row: rowNumber, field: "fuel_type", message: "Fuel type is invalid" });
          continue;
        }
        const transmission = row.transmission?.toLowerCase() || "";
        if (transmission && !TRANSMISSIONS.has(transmission)) {
          errors.push({ row: rowNumber, field: "transmission", message: "Transmission is invalid" });
          continue;
        }

        await db.insert(vehicles).values({
          id: newId(),
          transporterId,
          registrationNumber: registration,
          make,
          model: normalizedOptional(row.model, 100),
          bodyType: normalizedOptional(row.body_type, 50),
          category: normalizedOptional(row.category, 50),
          vehicleClass: normalizedOptional(row.vehicle_class, 50),
          colour: normalizedOptional(row.colour, 50),
          manufacturingYear,
          vin: normalizedOptional(row.vin, 50)?.toUpperCase() || null,
          chassisNumber: normalizedOptional(row.chassis_number, 100),
          engineNumber: normalizedOptional(row.engine_number, 100),
          fuelType: (fuelType || null) as any,
          transmission: (transmission || null) as any,
          seatingCapacity,
          grossWeight: normalizedOptional(row.gross_weight, 30),
          numberOfAxles,
          odometerReading,
          status: "active",
        });
        existingVehicleRegistrations.add(registration);
        importedCount += 1;
      }

      if (input.entityType === "transporters") {
        const companyName = normalizedOptional(row.company_name, 255);
        if (!companyName) {
          errors.push({ row: rowNumber, field: "company_name", message: "Company name is required" });
          continue;
        }
        if (existingTransporterNames.has(companyName)) {
          errors.push({ row: rowNumber, field: "company_name", message: "Transporter already exists" });
          continue;
        }
        const insuranceExpiry = row.insurance_expiry ? parseDateValue(row.insurance_expiry, true)?.dateOnly || null : null;
        if (row.insurance_expiry && !insuranceExpiry) {
          errors.push({ row: rowNumber, field: "insurance_expiry", message: "Insurance expiry date is invalid" });
          continue;
        }

        await db.insert(transporters).values({
          id: newId(),
          companyName,
          registrationNumber: normalizedOptional(row.registration_number, 100),
          tinNumber: normalizedOptional(row.tin_number, 100),
          gpsAddress: normalizedOptional(row.gps_address, 100),
          contactPerson: normalizedOptional(row.contact_person, 200),
          mobile: normalizedOptional(row.mobile, 50),
          email: normalizedOptional(row.email, 200),
          physicalAddress: normalizedOptional(row.physical_address, 2000),
          region: normalizedOptional(row.region, 100),
          district: normalizedOptional(row.district, 100),
          insuranceCompany: normalizedOptional(row.insurance_company, 200),
          insuranceExpiry,
        });
        existingTransporterNames.add(companyName);
        importedCount += 1;
      }

      if (input.entityType === "inspections") {
        const registration = row.registration_number.toUpperCase();
        const vehicleId = vehicleByRegistration.get(registration);
        if (!vehicleId) {
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
        const number = normalizedOptional(row.inspection_number, 100)
          || `HIST-${parsedDate.dateOnly.replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
        if (existingInspectionNumbers.has(number)) {
          errors.push({ row: rowNumber, field: "inspection_number", message: "Inspection number already exists" });
          continue;
        }
        const nextInspectionDate = row.next_inspection_date ? parseDateValue(row.next_inspection_date, true)?.dateOnly || null : null;
        if (row.next_inspection_date && !nextInspectionDate) {
          errors.push({ row: rowNumber, field: "next_inspection_date", message: "Next inspection date is invalid" });
          continue;
        }

        await db.insert(inspections).values({
          id,
          inspectionNumber: number,
          vehicleId,
          inspectionDate: parsedDate.date,
          inspectorName: normalizedOptional(row.inspector_name, 200) || "Historical import",
          station: normalizedOptional(row.station, 200) || "Historical record",
          workflowStatus: "archived",
          sectionData: [],
          overallResult: result as any,
          inspectorRemarks: normalizedOptional(row.inspector_remarks, 4000),
          nextInspectionDate,
          status: "historical_import",
        });
        existingInspectionNumbers.add(number);
        importedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database insert failed";
      errors.push({ row: rowNumber, field: "system", message: /unique|duplicate/i.test(message) ? "Duplicate record" : "Record could not be imported" });
    }
  }

  return finishImport();
}
