import { z } from "zod";
import { DRIVER_TRAINING_SERVICES } from "./driver-training";

export const TRAINING_SESSION_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
export const TRAINING_DELIVERY_MODES = ["onsite", "classroom", "practical", "hybrid"] as const;
export const TRAINING_ATTENDANCE_STATUSES = ["registered", "attended", "absent", "withdrawn"] as const;
export const TRAINING_ASSESSMENT_TYPES = ["pre_training", "post_training", "proficiency", "practical", "refresher"] as const;
export const TRAINING_RESULTS = ["pass", "fail", "competent", "not_yet_competent"] as const;
export const TRAINING_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const TRAINING_COMPLIANCE_CASE_TYPES = ["renewal", "reassessment", "licence_expiry", "high_risk"] as const;
export const TRAINING_COMPLIANCE_STATUSES = ["open", "contacted", "scheduled", "resolved", "dismissed"] as const;
export const TRAINING_COMPLIANCE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TRAINING_COMPLIANCE_CHANNELS = ["email", "phone", "sms", "whatsapp", "in_person"] as const;

const SERVICE_IDS = new Set(DRIVER_TRAINING_SERVICES.map((service) => service.id));
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalEmail = z.string().trim().max(200).optional().transform((value) => value || undefined).refine(
  (value) => !value || z.string().email().safeParse(value).success,
  "Enter a valid email address"
);
const optionalDate = z.string().trim().max(20).optional().transform((value) => value || undefined).refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Use a valid date"
);
const optionalScore = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().min(0).max(100).optional()
);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);

export const trainingSessionSchema = z.object({
  serviceId: z.string().trim().min(1).max(80).refine((value) => SERVICE_IDS.has(value), "Unknown training service"),
  title: z.string().trim().min(3).max(220),
  clientName: optionalText(220),
  transporterId: optionalUuid,
  locationId: optionalUuid,
  venue: optionalText(300),
  deliveryMode: z.enum(TRAINING_DELIVERY_MODES).default("onsite"),
  startAt: z.string().trim().min(1).max(40).transform((value) => new Date(value)).refine((value) => !Number.isNaN(value.getTime()), "Invalid start date/time"),
  endAt: z.string().trim().min(1).max(40).transform((value) => new Date(value)).refine((value) => !Number.isNaN(value.getTime()), "Invalid end date/time"),
  instructorId: optionalUuid,
  instructorName: optionalText(200),
  capacity: z.coerce.number().int().min(1).max(500).default(20),
  notes: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.endAt < value.startAt) {
    ctx.addIssue({ code: "custom", path: ["endAt"], message: "End date/time must be after the start date/time" });
  }
});

export const trainingParticipantSchema = z.object({
  sessionId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(200),
  companyName: optionalText(220),
  employeeNumber: optionalText(100),
  phone: optionalText(50),
  email: optionalEmail,
  driverLicenseNumber: optionalText(100),
  driverLicenseClass: optionalText(50),
  driverLicenseExpiry: optionalDate,
  notes: optionalText(4000),
});

export const trainingAssessmentSchema = z.object({
  participantId: z.string().uuid(),
  assessmentType: z.enum(TRAINING_ASSESSMENT_TYPES),
  theoryScore: optionalScore,
  practicalScore: optionalScore,
  result: z.enum(TRAINING_RESULTS),
  riskLevel: z.enum(TRAINING_RISK_LEVELS).optional().or(z.literal("")).transform((value) => value || undefined),
  strengths: optionalText(4000),
  improvementAreas: z.string().trim().max(4000).optional().transform((value) =>
    value ? [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30) : []
  ),
  remarks: optionalText(4000),
}).superRefine((value, ctx) => {
  if (value.theoryScore === undefined && value.practicalScore === undefined) {
    ctx.addIssue({ code: "custom", path: ["theoryScore"], message: "Enter at least one assessment score" });
  }
});

export const trainingCertificateSchema = z.object({
  participantId: z.string().uuid(),
  validityMonths: z.coerce.number().int().min(0).max(60).default(12),
});

export const trainingCertificateRevocationSchema = z.object({
  certificateId: z.string().uuid(),
  reason: z.string().trim().min(5, "Provide a revocation reason").max(2000),
});

export const trainingVerificationCodeSchema = z.string().trim().regex(/^[a-f0-9]{32}$/i, "Invalid verification code");

export const trainingSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(TRAINING_SESSION_STATUSES),
});

export const trainingAttendanceSchema = z.object({
  participantId: z.string().uuid(),
  status: z.enum(TRAINING_ATTENDANCE_STATUSES),
});

export const trainingComplianceCaseSchema = z.object({
  participantId: z.string().uuid(),
  certificateId: optionalUuid,
  caseType: z.enum(TRAINING_COMPLIANCE_CASE_TYPES),
  priority: z.enum(TRAINING_COMPLIANCE_PRIORITIES).default("medium"),
  dueDate: optionalDate,
  assignedTo: optionalUuid,
  preferredChannel: z.enum(TRAINING_COMPLIANCE_CHANNELS).optional().or(z.literal("")).transform((value) => value || undefined),
  notes: optionalText(4000),
});

export const trainingComplianceContactSchema = z.object({
  caseId: z.string().uuid(),
  channel: z.enum(TRAINING_COMPLIANCE_CHANNELS),
  summary: z.string().trim().min(3, "Record the contact outcome").max(4000),
  nextFollowUpDate: optionalDate,
});

export const trainingComplianceReminderSchema = z.object({
  caseId: z.string().uuid(),
  channel: z.enum(TRAINING_COMPLIANCE_CHANNELS),
});

export const trainingComplianceStatusSchema = z.object({
  caseId: z.string().uuid(),
  status: z.enum(TRAINING_COMPLIANCE_STATUSES),
  notes: optionalText(2000),
});

export function trainingValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 3).map((issue) => issue.message).join("; ") || "Invalid training data";
}

export function calculateOverallScore(theoryScore?: number, practicalScore?: number) {
  const scores = [theoryScore, practicalScore].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
}

export function isPassingTrainingResult(result: string) {
  return result === "pass" || result === "competent";
}

export function effectiveTrainingCertificateStatus(
  status: string,
  expiryDate?: string | Date | null,
  now = new Date(),
) {
  if (status === "revoked") return "revoked" as const;
  if (expiryDate) {
    const expiry = expiryDate instanceof Date ? expiryDate : new Date(`${expiryDate}T23:59:59.999Z`);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) return "expired" as const;
  }
  return "active" as const;
}

export function daysUntilTrainingDate(value?: string | Date | null, now = new Date()) {
  if (!value) return null;
  const target = value instanceof Date ? value : new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function deriveTrainingCompliancePriority(
  caseType: string,
  dueDate?: string | Date | null,
  riskLevel?: string | null,
  now = new Date(),
) {
  if (riskLevel === "critical") return "critical" as const;
  if (caseType === "high_risk" && riskLevel === "high") return "high" as const;
  if (caseType === "reassessment") return "high" as const;
  const days = daysUntilTrainingDate(dueDate, now);
  if (days !== null && days < 0) return "critical" as const;
  if (days !== null && days <= 14) return "high" as const;
  if (days !== null && days <= 60) return "medium" as const;
  return "low" as const;
}

export function buildTrainingComplianceReminder(input: {
  participantName: string;
  caseType: string;
  serviceTitle?: string | null;
  certificateNumber?: string | null;
  dueDate?: string | null;
}) {
  const service = input.serviceTitle ? ` for ${input.serviceTitle}` : "";
  const certificate = input.certificateNumber ? ` Certificate ${input.certificateNumber}.` : "";
  const due = input.dueDate ? ` Action is due by ${input.dueDate}.` : "";
  const action = input.caseType === "renewal"
    ? "Please arrange renewal training or assessment before validity lapses."
    : input.caseType === "reassessment"
      ? "A new passing reassessment is required before certificate reissue."
      : input.caseType === "licence_expiry"
        ? "Please confirm renewed driving-licence details before further qualification activity."
        : "Please arrange a safety review, coaching, or reassessment for the identified risk exposure.";
  return `Driver Training & Assessment reminder for ${input.participantName}${service}.${certificate}${due} ${action}`.slice(0, 1000);
}

export function canTransitionTrainingComplianceCase(current: string, next: string) {
  if (current === next) return true;
  const allowed: Record<string, readonly string[]> = {
    open: ["contacted", "scheduled", "resolved", "dismissed"],
    contacted: ["scheduled", "resolved", "dismissed"],
    scheduled: ["contacted", "resolved", "dismissed"],
    resolved: [],
    dismissed: [],
  };
  return Boolean(allowed[current]?.includes(next));
}

export function canTransitionTrainingSession(current: string, next: string) {
  if (current === next) return true;
  const allowed: Record<string, readonly string[]> = {
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return Boolean(allowed[current]?.includes(next));
}
