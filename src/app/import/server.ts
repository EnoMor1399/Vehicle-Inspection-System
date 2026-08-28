"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { importJobs, inspections, transporters, vehicles } from "@/db/schema";
import { newId } from "@/lib/utils";
import { getCurrentUser, canImport } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

const REQUIRED: Record<string, string[]> = {
  vehicles: ["registration_number", "make"],
  transporters: ["company_name"],
  inspections: ["registration_number", "inspection_date", "overall_result"],
};

function mapRow(row: Record<string, string>, mapping: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(mapping)
      .filter(([, source]) => Boolean(source))
      .map(([target, source]) => [target, String(row[source] ?? "").trim()])
  );
}

function intOrNull(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  if (!Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > 500) throw new Error("Import must contain 1 to 500 rows");

  const jobId = newId();
  const mappedRows = input.rows.map((row) => mapRow(row, input.mapping));
  const errors: { row: number; field: string; message: string }[] = [];
  let importedCount = 0;

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
        const date = new Date(row.inspection_date);
        if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 5 * 60_000) {
          errors.push({ row: rowNumber, field: "inspection_date", message: "Invalid or future inspection date" });
          continue;
        }
        const id = newId();
        const number = row.inspection_number || `HIST-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
        const [duplicate] = await db.select({ id: inspections.id }).from(inspections).where(eq(inspections.inspectionNumber, number));
        if (duplicate) {
          errors.push({ row: rowNumber, field: "inspection_number", message: "Inspection number already exists" });
          continue;
        }
        await db.insert(inspections).values({
          id,
          inspectionNumber: number,
          vehicleId: vehicle.id,
          inspectionDate: date,
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
  return { imported: importedCount, invalid: mappedRows.length - importedCount, jobId };
}
