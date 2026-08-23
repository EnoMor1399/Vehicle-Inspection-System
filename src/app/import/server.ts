"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { importJobs, vehicles, transporters } from "@/db/schema";
import { newId } from "@/lib/utils";
import { getCurrentUser, canImport } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function submitImport(input: {
  fileName: string;
  fileType: string;
  entityType: string;
  rows: Record<string, string>[];
  mapping: Record<string, string>;
}) {
  const user = await getCurrentUser();
  if (!canImport(user)) throw new Error("Not authorised to import");

  const jobId = newId();
  const total = input.rows.length;
  // Validation: each row must have all mapped fields non-empty
  const valid: Record<string, string>[] = [];
  const errors: { row: number; field: string; message: string }[] = [];
  input.rows.forEach((row, idx) => {
    let ok = true;
    Object.entries(input.mapping).forEach(([target, source]) => {
      if (!source || !row[source]) {
        errors.push({ row: idx + 1, field: target, message: "Missing value" });
        ok = false;
      }
    });
    if (ok) valid.push(row);
  });

  let importedCount = 0;

  // Actually insert data into target tables
  if (valid.length > 0) {
    try {
      if (input.entityType === "vehicles") {
        for (const row of valid) {
          const vehicleData: any = {
            id: newId(),
            registrationNumber: row.registration_number || row.registrationNumber || "",
            make: row.make || "",
            model: row.model || null,
            variant: row.variant || null,
            bodyType: row.body_type || row.bodyType || null,
            category: row.category || null,
            vehicleClass: row.vehicle_class || row.vehicleClass || null,
            colour: row.colour || row.color || null,
            manufacturingYear: row.manufacturing_year || row.manufacturingYear ? parseInt(row.manufacturing_year || row.manufacturingYear) : null,
            vin: row.vin || null,
            chassisNumber: row.chassis_number || row.chassisNumber || null,
            engineNumber: row.engine_number || row.engineNumber || null,
            fuelType: row.fuel_type || row.fuelType || null,
            transmission: row.transmission || null,
            status: (row.status || "active") as any,
          };

          // Try to link to transporter if provided
          if (row.transporter_name || row.transporterName) {
            const [transporter] = await db
              .select()
              .from(transporters)
              .where(eq(transporters.companyName, row.transporter_name || row.transporterName));
            if (transporter) {
              vehicleData.transporterId = transporter.id;
            }
          }

          await db.insert(vehicles).values(vehicleData);
          importedCount++;
        }
      } else if (input.entityType === "transporters") {
        for (const row of valid) {
          const transporterData: any = {
            id: newId(),
            companyName: row.company_name || row.companyName || "",
            registrationNumber: row.registration_number || row.registrationNumber || null,
            tinNumber: row.tin_number || row.tinNumber || null,
            gpsAddress: row.gps_address || row.gpsAddress || null,
            contactPerson: row.contact_person || row.contactPerson || null,
            mobile: row.mobile || row.phone || null,
            email: row.email || null,
            physicalAddress: row.physical_address || row.physicalAddress || null,
            region: row.region || null,
            district: row.district || null,
            insuranceCompany: row.insurance_company || row.insuranceCompany || null,
            insuranceExpiry: row.insurance_expiry || row.insuranceExpiry || null,
          };

          await db.insert(transporters).values(transporterData);
          importedCount++;
        }
      }
    } catch (err) {
      console.error("Import error:", err);
      errors.push({ row: 0, field: "system", message: `Database insert failed: ${(err as Error).message}` });
    }
  }

  await db.insert(importJobs).values({
    id: jobId,
    fileName: input.fileName,
    fileType: input.fileType,
    entityType: input.entityType,
    status: importedCount > 0 ? "completed" : "failed",
    totalRows: total,
    validRows: valid.length,
    invalidRows: total - valid.length,
    importedRows: importedCount,
    columnMapping: input.mapping,
    errors: errors.slice(0, 200),
    createdBy: user.id,
    completedAt: new Date(),
  });

  revalidatePath("/import");
  revalidatePath("/vehicles");
  revalidatePath("/transporters");
  return { imported: importedCount, invalid: total - importedCount, jobId };
}

export async function rollbackImport(jobId: string) {
  const user = await getCurrentUser();
  if (!canImport(user)) throw new Error("Not authorised");
  const { importJobs: ij } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(ij).set({ status: "rolled_back", rollbackAt: new Date() }).where(eq(ij.id, jobId));
  revalidatePath("/import");
}
