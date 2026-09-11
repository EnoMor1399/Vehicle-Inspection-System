import { z } from "zod";
import { DRIVER_TRAINING_SERVICES } from "./driver-training";

export const TRAINING_REQUEST_TYPES = ["client", "internal"] as const;
export const TRAINING_REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TRAINING_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "scheduled",
  "cancelled",
] as const;

const SERVICE_IDS = new Set(DRIVER_TRAINING_SERVICES.map((service) => service.id));
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional().or(z.literal("")).transform((value) => value || undefined);
const dateTime = (label: string) => z.string().trim().min(1).max(40).transform((value) => new Date(value)).refine(
  (value) => !Number.isNaN(value.getTime()),
  `Invalid ${label} date/time`,
);

export const trainingRequestCreateSchema = z.object({
  requestType: z.enum(TRAINING_REQUEST_TYPES).default("client"),
  serviceId: z.string().trim().min(1).max(80).refine((value) => SERVICE_IDS.has(value), "Unknown training service"),
  title: z.string().trim().min(3).max(220),
  clientName: optionalText(220),
  contactName: optionalText(180),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")).transform((value) => value || undefined),
  contactPhone: optionalText(50),
  requestedParticipants: z.coerce.number().int().min(1).max(5000),
  preferredStartDate: optionalDate,
  preferredEndDate: optionalDate,
  locationId: optionalUuid,
  venue: optionalText(300),
  deliveryMode: z.enum(["onsite", "classroom", "practical", "hybrid", "virtual"]),
  priority: z.enum(TRAINING_REQUEST_PRIORITIES).default("normal"),
  businessNeed: optionalText(4000),
  notes: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.requestType === "client" && !value.clientName) {
    ctx.addIssue({ code: "custom", path: ["clientName"], message: "Client requests require a client name" });
  }
  if (value.preferredStartDate && value.preferredEndDate && value.preferredEndDate < value.preferredStartDate) {
    ctx.addIssue({ code: "custom", path: ["preferredEndDate"], message: "Preferred end date must be on or after the start date" });
  }
});

export const trainingRequestTransitionSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(TRAINING_REQUEST_STATUSES),
  reviewNotes: optionalText(4000),
});

export const trainingRequestScheduleSchema = z.object({
  requestId: z.string().uuid(),
  startAt: dateTime("start"),
  endAt: dateTime("end"),
  instructorId: optionalUuid,
  instructorName: optionalText(200),
  capacity: z.coerce.number().int().min(1).max(5000),
  venue: optionalText(300),
  locationId: optionalUuid,
  notes: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.endAt.getTime() <= value.startAt.getTime()) {
    ctx.addIssue({ code: "custom", path: ["endAt"], message: "Session end time must be after start time" });
  }
});

const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  draft: new Set(["submitted", "cancelled"]),
  submitted: new Set(["under_review", "approved", "rejected", "cancelled"]),
  under_review: new Set(["approved", "rejected", "cancelled"]),
  approved: new Set(["scheduled", "cancelled"]),
  rejected: new Set(),
  scheduled: new Set(),
  cancelled: new Set(),
};

export function canTransitionTrainingRequest(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function trainingRequestNeedsReviewAttribution(status: string) {
  return status === "approved" || status === "rejected";
}

export function trainingRequestValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid training request data";
}

export function requestSchedulingCapacityIsValid(requestedParticipants: number, capacity: number) {
  return Number.isInteger(requestedParticipants) && Number.isInteger(capacity) && requestedParticipants > 0 && capacity >= requestedParticipants;
}
