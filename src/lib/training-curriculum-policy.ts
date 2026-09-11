import { z } from "zod";
import { DRIVER_TRAINING_SERVICES } from "./driver-training";

export const TRAINING_CURRICULUM_STATUSES = ["active", "inactive"] as const;
export const TRAINING_CURRICULUM_VERSION_STATUSES = ["draft", "approved", "superseded", "retired"] as const;
export const TRAINING_MATRIX_SCOPE_TYPES = ["global", "client", "role"] as const;

const SERVICE_IDS = new Set(DRIVER_TRAINING_SERVICES.map((service) => service.id));
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);
const dateText = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

function listField(maxItems: number, maxItemLength = 300) {
  return z.string().trim().max(8000).transform((value) =>
    [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
      .map((item) => item.slice(0, maxItemLength))
      .slice(0, maxItems)
  );
}

export const trainingCurriculumSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9._-]{2,39}$/, "Use a curriculum code such as DDT-001"),
  serviceId: z.string().trim().min(1).max(80).refine((value) => SERVICE_IDS.has(value), "Unknown training service"),
  title: z.string().trim().min(3).max(220),
  status: z.enum(TRAINING_CURRICULUM_STATUSES).default("active"),
  ownerId: optionalUuid,
  notes: optionalText(4000),
});

export const trainingCurriculumVersionSchema = z.object({
  curriculumId: z.string().uuid(),
  versionNumber: z.string().trim().regex(/^\d{1,3}\.\d{1,3}$/, "Use a version such as 1.0 or 2.1"),
  effectiveFrom: dateText,
  reviewDueDate: dateText,
  totalHours: z.coerce.number().positive().max(500),
  theoryPassMark: z.coerce.number().int().min(0).max(100),
  practicalPassMark: z.coerce.number().int().min(0).max(100),
  minimumAttendanceMinutes: z.coerce.number().int().min(0).max(30_000).default(0),
  learningObjectives: listField(40),
  competencies: listField(40),
  modules: listField(60),
  changeSummary: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.reviewDueDate < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["reviewDueDate"], message: "Review due date must be on or after the effective date" });
  }
  if (value.learningObjectives.length === 0) {
    ctx.addIssue({ code: "custom", path: ["learningObjectives"], message: "Add at least one learning objective" });
  }
  if (value.competencies.length === 0) {
    ctx.addIssue({ code: "custom", path: ["competencies"], message: "Add at least one competency" });
  }
  if (value.modules.length === 0) {
    ctx.addIssue({ code: "custom", path: ["modules"], message: "Add at least one curriculum module" });
  }
});

export const trainingCurriculumApprovalSchema = z.object({
  versionId: z.string().uuid(),
});

export const trainingSessionCurriculumSchema = z.object({
  sessionId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const trainingMatrixRequirementSchema = z.object({
  scopeType: z.enum(TRAINING_MATRIX_SCOPE_TYPES),
  clientName: optionalText(220),
  jobRole: optionalText(160),
  serviceId: z.string().trim().min(1).max(80).refine((value) => SERVICE_IDS.has(value), "Unknown training service"),
  recurrenceMonths: z.coerce.number().int().min(0).max(120).default(12),
  minimumLicenseClass: optionalText(50),
  required: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  notes: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.scopeType === "client" && !value.clientName) {
    ctx.addIssue({ code: "custom", path: ["clientName"], message: "Client-scoped requirements need a client name" });
  }
  if (value.scopeType === "role" && !value.jobRole) {
    ctx.addIssue({ code: "custom", path: ["jobRole"], message: "Role-scoped requirements need a job role" });
  }
});

export function trainingCurriculumValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid curriculum data";
}

export function buildTrainingMatrixRequirementKey(input: {
  scopeType: string;
  clientName?: string | null;
  jobRole?: string | null;
  serviceId: string;
}) {
  const normalize = (value?: string | null) => (value || "").trim().toLowerCase().replace(/\s+/g, " ");
  return [input.scopeType, normalize(input.clientName), normalize(input.jobRole), input.serviceId.trim().toLowerCase()].join("|");
}

export function canApproveTrainingCurriculumVersion(input: {
  status: string;
  effectiveFrom: string | Date;
  reviewDueDate: string | Date;
  totalHours: string | number;
  theoryPassMark: number;
  practicalPassMark: number;
  learningObjectives: unknown;
  competencies: unknown;
  modules: unknown;
}) {
  if (input.status !== "draft") return false;
  const effective = input.effectiveFrom instanceof Date ? input.effectiveFrom : new Date(`${input.effectiveFrom}T00:00:00Z`);
  const review = input.reviewDueDate instanceof Date ? input.reviewDueDate : new Date(`${input.reviewDueDate}T00:00:00Z`);
  if (Number.isNaN(effective.getTime()) || Number.isNaN(review.getTime()) || review < effective) return false;
  if (!Number.isFinite(Number(input.totalHours)) || Number(input.totalHours) <= 0) return false;
  if (input.theoryPassMark < 0 || input.theoryPassMark > 100 || input.practicalPassMark < 0 || input.practicalPassMark > 100) return false;
  return [input.learningObjectives, input.competencies, input.modules].every((value) => Array.isArray(value) && value.length > 0);
}

export function curriculumReviewState(reviewDueDate: string | Date, now = new Date()) {
  const review = reviewDueDate instanceof Date ? reviewDueDate : new Date(`${reviewDueDate}T23:59:59.999Z`);
  if (Number.isNaN(review.getTime())) return "unknown" as const;
  if (review.getTime() < now.getTime()) return "overdue" as const;
  const days = Math.ceil((review.getTime() - now.getTime()) / 86_400_000);
  if (days <= 30) return "due_soon" as const;
  return "current" as const;
}

export function canBindCurriculumToSession(sessionStatus: string, versionStatus: string, sessionServiceId: string, curriculumServiceId: string) {
  return sessionStatus === "scheduled" && versionStatus === "approved" && sessionServiceId === curriculumServiceId;
}
