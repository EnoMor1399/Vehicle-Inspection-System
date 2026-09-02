import { z } from "zod";
import {
  MAX_COMBINED_EVIDENCE_PHOTO_CHARS,
  MAX_EVIDENCE_PHOTO_DATA_URL_CHARS,
  MAX_EVIDENCE_PHOTOS_PER_INSPECTION,
  MAX_EVIDENCE_PHOTOS_PER_ITEM,
  isSupportedEvidenceImageDataUrl,
} from "@/lib/inspection-evidence";

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

const evidenceImageDataUrl = z.string()
  .max(MAX_EVIDENCE_PHOTO_DATA_URL_CHARS)
  .refine(isSupportedEvidenceImageDataUrl, "Evidence photo must be a bounded base64 JPEG, PNG, or WebP data URL");

const inspectionItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  result: z.enum(["pass", "fail", "na"]),
  severity: z.enum(["minor", "major", "critical"]).optional(),
  remarks: optionalText(2000),
  photos: z.array(z.object({
    id: z.string().max(100),
    dataUrl: evidenceImageDataUrl,
    caption: optionalText(500),
    takenAt: z.string().max(100),
  })).max(MAX_EVIDENCE_PHOTOS_PER_ITEM).optional(),
});

const inspectionSectionSchema = z.object({
  section: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  items: z.array(inspectionItemSchema).max(100),
});

export const inspectionCreateSchema = z.object({
  vehicleId: z.string().uuid(),
  sectionData: z.array(inspectionSectionSchema).min(1).max(20),
  overallResult: inspectionResult,
  inspectorName: optionalText(200),
  station: optionalText(200),
  workflowStatus: workflowStatus.optional().default("completed"),
}).strict().superRefine((value, ctx) => {
  let photoCount = 0;
  let photoDataCharacters = 0;

  for (const section of value.sectionData) {
    for (const item of section.items) {
      for (const photo of item.photos || []) {
        photoCount += 1;
        photoDataCharacters += photo.dataUrl.length;
      }
    }
  }

  if (photoCount > MAX_EVIDENCE_PHOTOS_PER_INSPECTION) {
    ctx.addIssue({
      code: "custom",
      path: ["sectionData"],
      message: `Inspection evidence is limited to ${MAX_EVIDENCE_PHOTOS_PER_INSPECTION} photos per inspection`,
    });
  }

  if (photoDataCharacters > MAX_COMBINED_EVIDENCE_PHOTO_CHARS) {
    ctx.addIssue({
      code: "custom",
      path: ["sectionData"],
      message: "Combined inspection evidence is too large",
    });
  }
});

export const webhookCreateSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(webhookEvent).min(1).max(4),
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
