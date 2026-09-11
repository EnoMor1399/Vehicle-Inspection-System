import { z } from "zod";

export const TRAINING_DEVELOPMENT_STATUSES = ["open", "in_progress", "verification", "completed", "cancelled"] as const;
export const TRAINING_DEVELOPMENT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TRAINING_DEVELOPMENT_ACTION_TYPES = ["coaching", "retraining", "reassessment", "practical_observation", "mentoring", "medical_review", "administrative", "other"] as const;
export const TRAINING_DEVELOPMENT_ACTION_STATUSES = ["pending", "in_progress", "completed", "waived"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional().or(z.literal("")).transform((value) => value || undefined);

function listField(maxItems: number, maxItemLength = 300) {
  return z.string().trim().max(8000).transform((value) =>
    [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
      .map((item) => item.slice(0, maxItemLength))
      .slice(0, maxItems)
  );
}

export const trainingDevelopmentPlanSchema = z.object({
  participantId: z.string().uuid(),
  sourceAssessmentId: optionalUuid,
  title: z.string().trim().min(3).max(220),
  priority: z.enum(TRAINING_DEVELOPMENT_PRIORITIES).default("medium"),
  competencyGaps: listField(40),
  targetDate: optionalDate,
  ownerId: optionalUuid,
}).superRefine((value, ctx) => {
  if (value.competencyGaps.length === 0) {
    ctx.addIssue({ code: "custom", path: ["competencyGaps"], message: "Add at least one competency gap" });
  }
});

export const trainingDevelopmentActionSchema = z.object({
  planId: z.string().uuid(),
  actionType: z.enum(TRAINING_DEVELOPMENT_ACTION_TYPES),
  description: z.string().trim().min(3).max(4000),
  dueDate: optionalDate,
  notes: optionalText(4000),
});

export const trainingDevelopmentActionTransitionSchema = z.object({
  actionId: z.string().uuid(),
  status: z.enum(TRAINING_DEVELOPMENT_ACTION_STATUSES),
  evidenceReference: optionalText(500),
  notes: optionalText(4000),
});

export const trainingDevelopmentPlanTransitionSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(TRAINING_DEVELOPMENT_STATUSES),
  verificationSummary: optionalText(4000),
});

const PLAN_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  open: new Set(["in_progress", "cancelled"]),
  in_progress: new Set(["verification", "cancelled"]),
  verification: new Set(["completed", "in_progress", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const ACTION_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  pending: new Set(["in_progress", "completed", "waived"]),
  in_progress: new Set(["completed", "waived"]),
  completed: new Set(),
  waived: new Set(),
};

export function canTransitionTrainingDevelopmentPlan(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return PLAN_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function canTransitionTrainingDevelopmentAction(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return ACTION_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function isTrainingDevelopmentActionOpen(status: string) {
  return status === "pending" || status === "in_progress";
}

export function isTrainingDevelopmentActionOverdue(status: string, dueDate?: string | Date | null, now = new Date()) {
  if (!isTrainingDevelopmentActionOpen(status) || !dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function trainingDevelopmentValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid development plan data";
}
