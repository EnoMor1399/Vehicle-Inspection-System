import { z } from "zod";

export const TRAINING_FEEDBACK_RESPONDENTS = ["participant", "client", "instructor", "observer"] as const;
export const TRAINING_QUALITY_SOURCES = ["feedback", "assessment", "evidence", "readiness", "incident", "audit", "management_review"] as const;
export const TRAINING_QUALITY_CATEGORIES = ["training_content", "instructor", "safety", "equipment", "attendance", "assessment", "documentation", "client_service", "other"] as const;
export const TRAINING_QUALITY_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const TRAINING_QUALITY_STATUSES = ["open", "in_progress", "verification", "closed", "dismissed"] as const;

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalDate = z.string().trim().max(20).optional().transform((value) => value || undefined).refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Use a valid date",
);
const rating = z.coerce.number().int().min(1).max(5);

export const trainingFeedbackSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  respondentType: z.enum(TRAINING_FEEDBACK_RESPONDENTS),
  contentRating: rating,
  instructorRating: rating,
  practicalRating: rating,
  safetyRating: rating,
  overallRating: rating,
  wouldRecommend: z.enum(["yes", "no", ""]).default("").transform((value) => value === "" ? undefined : value === "yes"),
  comments: optionalText(4000),
  improvementSuggestions: optionalText(4000),
  anonymous: z.coerce.boolean().default(false),
});

export const trainingQualityFindingSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  source: z.enum(TRAINING_QUALITY_SOURCES),
  category: z.enum(TRAINING_QUALITY_CATEGORIES),
  severity: z.enum(TRAINING_QUALITY_SEVERITIES).default("medium"),
  title: boundedText(3, 220),
  description: boundedText(5, 4000),
  ownerId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  dueDate: optionalDate,
  rootCause: optionalText(4000),
  actionPlan: optionalText(4000),
});

export const trainingQualityProgressSchema = z.object({
  findingId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "verification", "dismissed"]),
  ownerId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  dueDate: optionalDate,
  rootCause: optionalText(4000),
  actionPlan: optionalText(4000),
  note: optionalText(2000),
});

export const trainingQualityClosureSchema = z.object({
  findingId: z.string().uuid(),
  rootCause: boundedText(5, 4000),
  actionPlan: boundedText(5, 4000),
  closureEvidence: boundedText(5, 4000),
  effectivenessReview: boundedText(5, 4000),
});

export function trainingQualityValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 3).map((issue) => issue.message).join("; ") || "Invalid training quality data";
}

export function calculateTrainingEffectivenessScore(ratings: readonly number[]) {
  const valid = ratings.filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
  if (valid.length === 0) return 0;
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.round(average * 20 * 10) / 10;
}

export function feedbackQualitySignal(overallRating: number, safetyRating: number) {
  if (safetyRating <= 1 || overallRating <= 1) return "critical" as const;
  if (safetyRating <= 2 || overallRating <= 2) return "high" as const;
  if (safetyRating === 3 || overallRating === 3) return "medium" as const;
  return "low" as const;
}

export function canTransitionTrainingQualityFinding(current: string, next: string) {
  if (current === next) return true;
  const allowed: Record<string, readonly string[]> = {
    open: ["in_progress", "verification", "dismissed"],
    in_progress: ["open", "verification", "dismissed"],
    verification: ["in_progress", "closed", "dismissed"],
    closed: [],
    dismissed: [],
  };
  return Boolean(allowed[current]?.includes(next));
}

export function isQualityFindingOverdue(status: string, dueDate?: string | Date | null, now = new Date()) {
  if (["closed", "dismissed"].includes(status) || !dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(`${dueDate}T23:59:59.999Z`);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}
