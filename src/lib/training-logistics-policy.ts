import { z } from "zod";

export const TRAINING_RESOURCE_TYPES = [
  "vehicle",
  "simulator",
  "classroom",
  "training_equipment",
  "safety_equipment",
  "materials",
  "audiovisual",
  "other",
] as const;

export const TRAINING_RESOURCE_STATUSES = ["available", "maintenance", "out_of_service", "retired"] as const;
export const TRAINING_RESOURCE_ALLOCATION_STATUSES = ["reserved", "confirmed", "released", "cancelled"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);
const optionalDate = z.string().trim().optional().or(z.literal("")).refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use a valid date").transform((value) => value || undefined);

export const trainingResourceSchema = z.object({
  resourceCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]{2,39}$/, "Use a resource code such as TRV-001"),
  name: z.string().trim().min(2).max(220),
  resourceType: z.enum(TRAINING_RESOURCE_TYPES),
  status: z.enum(TRAINING_RESOURCE_STATUSES).default("available"),
  locationId: optionalUuid,
  identifier: optionalText(140),
  isExclusive: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  availableQuantity: z.coerce.number().int().min(1).max(100_000),
  capacity: z.coerce.number().int().min(1).max(10_000),
  serviceDueDate: optionalDate,
  inspectionDueDate: optionalDate,
  notes: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.isExclusive && value.availableQuantity !== 1) {
    ctx.addIssue({ code: "custom", path: ["availableQuantity"], message: "Exclusive resources must have an available quantity of 1" });
  }
});

export const trainingResourceStatusSchema = z.object({
  resourceId: z.string().uuid(),
  status: z.enum(TRAINING_RESOURCE_STATUSES),
  note: optionalText(1000),
});

export const trainingResourceAllocationSchema = z.object({
  resourceId: z.string().uuid(),
  sessionId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100_000),
  notes: optionalText(2000),
});

export const trainingResourceAllocationStatusSchema = z.object({
  allocationId: z.string().uuid(),
  status: z.enum(TRAINING_RESOURCE_ALLOCATION_STATUSES),
  note: optionalText(1000),
});

export function trainingLogisticsValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid training logistics data";
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function resourceDemandFits(input: {
  isExclusive: boolean;
  availableQuantity: number;
  requestedQuantity: number;
  concurrentQuantities: number[];
}) {
  if (input.requestedQuantity < 1 || input.availableQuantity < 1) return false;
  const activeDemand = input.concurrentQuantities.reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
  if (input.isExclusive) return input.requestedQuantity === 1 && activeDemand === 0;
  return activeDemand + input.requestedQuantity <= input.availableQuantity;
}

export function trainingResourceOperationalState(resource: {
  status: string;
  serviceDueDate?: string | Date | null;
  inspectionDueDate?: string | Date | null;
}, now = new Date()) {
  if (resource.status === "retired") return "retired" as const;
  if (resource.status === "maintenance" || resource.status === "out_of_service") return "blocked" as const;

  const dueDates = [resource.serviceDueDate, resource.inspectionDueDate]
    .filter(Boolean)
    .map((value) => value instanceof Date ? value : new Date(`${value}T23:59:59.999Z`));
  if (dueDates.some((value) => !Number.isNaN(value.getTime()) && value.getTime() < now.getTime())) return "overdue" as const;
  if (dueDates.some((value) => {
    if (Number.isNaN(value.getTime())) return false;
    return value.getTime() - now.getTime() <= 30 * 86_400_000;
  })) return "attention" as const;
  return "ready" as const;
}

export function canAllocateTrainingResource(sessionStatus: string, resourceState: string) {
  return sessionStatus === "scheduled" && (resourceState === "ready" || resourceState === "attention");
}

export function canTransitionTrainingResourceAllocation(current: string, next: string) {
  if (current === next) return true;
  const transitions: Record<string, string[]> = {
    reserved: ["confirmed", "cancelled", "released"],
    confirmed: ["released", "cancelled"],
    released: [],
    cancelled: [],
  };
  return (transitions[current] || []).includes(next);
}
