import { z } from "zod";

const vehicleStatus = z.enum(["active", "under_inspection", "failed", "passed", "suspended", "decommissioned"]);
const vehicleCreateStatus = z.enum(["active", "suspended"]);
const fuelType = z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg"]);
const transmission = z.enum(["manual", "automatic", "cvt", "semi-automatic"]);
const inspectionResult = z.enum(["pass", "conditional_pass", "reinspection_required", "fail"]);
const workflowStatus = z.enum(["draft", "scheduled", "in_progress", "completed", "approved", "failed", "reinspection", "archived"]);
const webhookEvent = z.enum([
  "vehicle.created",
  "vehicle.updated",
  "inspection.completed",
  "inspection.failed",
  "user.created",
]);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const vehicleCreateSchema = z.object({
  registration_number: z.string().trim().min(2).max(50),
  make: z.string().trim().min(1).max(100),
  transporter_id: z.string().uuid().optional().nullable(),
  model: optionalText(100),
  body_type: optionalText(50),
  category: optionalText(50),
  vehicle_class: optionalText(50),
  colour: optionalText(50),
  manufacturing_year: z.coerce.number().int().min(1886).max(new Date().getFullYear() + 1).optional().nullable(),
  vin: optionalText(50),
  chassis_number: optionalText(100),
  engine_number: optionalText(100),
  fuel_type: fuelType.optional().nullable(),
  transmission: transmission.optional().nullable(),
  status: vehicleCreateStatus.optional().default("active"),
}).strict();

export const vehiclePatchSchema = vehicleCreateSchema
  .omit({ registration_number: true, make: true })
  .extend({
    registration_number: z.string().trim().min(2).max(50).optional(),
    make: z.string().trim().min(1).max(100).optional(),
    odometer_reading: z.coerce.number().int().min(0).max(20_000_000).optional().nullable(),
    status: vehicleStatus.optional(),
  })
  .partial()
  .strict();

const inspectionItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  result: z.enum(["pass", "fail", "na"]),
  severity: z.enum(["minor", "major", "critical"]).optional(),
  remarks: optionalText(2000),
  photos: z.array(z.object({
    id: z.string().max(100),
    dataUrl: z.string().max(8_000_000),
    caption: optionalText(500),
    takenAt: z.string().max(100),
  })).max(20).optional(),
});

const inspectionSectionSchema = z.object({
  section: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  items: z.array(inspectionItemSchema).max(250),
});

export const inspectionCreateSchema = z.object({
  vehicleId: z.string().uuid(),
  sectionData: z.array(inspectionSectionSchema).min(1).max(50),
  overallResult: inspectionResult,
  inspectorName: optionalText(200),
  station: optionalText(200),
  workflowStatus: workflowStatus.optional().default("completed"),
}).strict();

export const webhookCreateSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(webhookEvent).min(1).max(5),
  secret: z.string().trim().min(24).max(500).optional().nullable(),
  description: optionalText(1000),
}).strict();

export const rfidAssociationSchema = z.object({
  tag: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9:_-]+$/, "RFID tag contains unsupported characters"),
  vehicle_id: z.string().uuid(),
}).strict();

export function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}
