import { z } from "zod";

export const TRAINING_RISK_ASSESSMENT_STATUSES = ["draft", "approved", "blocked", "superseded"] as const;
export const TRAINING_SAFETY_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export const TRAINING_SAFETY_HAZARD_STATUSES = ["open", "controlled", "accepted"] as const;
export const TRAINING_SAFETY_INCIDENT_TYPES = [
  "near_miss",
  "unsafe_condition",
  "first_aid",
  "injury",
  "property_damage",
  "environmental",
  "equipment_failure",
  "other",
] as const;
export const TRAINING_SAFETY_INCIDENT_STATUSES = ["open", "investigating", "corrective_action", "verification", "closed"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalUuid = z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined);

export const trainingRiskAssessmentSchema = z.object({
  sessionId: z.string().uuid(),
  activityScope: z.string().trim().min(10).max(4000),
  emergencyPlan: z.string().trim().min(10).max(4000),
  overallRisk: z.enum(TRAINING_SAFETY_RISK_LEVELS).default("medium"),
  notes: optionalText(4000),
});

export const trainingSafetyHazardSchema = z.object({
  assessmentId: z.string().uuid(),
  hazard: z.string().trim().min(3).max(2000),
  consequence: z.string().trim().min(3).max(2000),
  likelihood: z.coerce.number().int().min(1).max(5),
  severity: z.coerce.number().int().min(1).max(5),
  controls: z.string().trim().min(3).max(4000),
  residualLikelihood: z.coerce.number().int().min(1).max(5),
  residualSeverity: z.coerce.number().int().min(1).max(5),
  status: z.enum(TRAINING_SAFETY_HAZARD_STATUSES).default("controlled"),
  ownerId: optionalUuid,
});

export const trainingRiskAssessmentTransitionSchema = z.object({
  assessmentId: z.string().uuid(),
  status: z.enum(["approved", "blocked"]),
  notes: optionalText(4000),
});

export const trainingSafetyIncidentSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: optionalUuid,
  incidentType: z.enum(TRAINING_SAFETY_INCIDENT_TYPES),
  severity: z.enum(TRAINING_SAFETY_RISK_LEVELS),
  occurredAt: z.string().trim().min(1).max(40).transform((value) => new Date(value)).refine((value) => !Number.isNaN(value.getTime()), "Invalid incident date/time"),
  location: optionalText(300),
  description: z.string().trim().min(5).max(6000),
  immediateActions: z.string().trim().min(5).max(6000),
  stopWork: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  ownerId: optionalUuid,
});

export const trainingSafetyIncidentTransitionSchema = z.object({
  incidentId: z.string().uuid(),
  status: z.enum(TRAINING_SAFETY_INCIDENT_STATUSES),
  rootCause: optionalText(6000),
  correctiveActions: optionalText(6000),
  evidenceReference: optionalText(500),
  closureReview: optionalText(6000),
});

const INCIDENT_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  open: new Set(["investigating"]),
  investigating: new Set(["corrective_action"]),
  corrective_action: new Set(["verification"]),
  verification: new Set(["closed", "corrective_action"]),
  closed: new Set(),
};

export function calculateTrainingSafetyRiskScore(likelihood: number, severity: number) {
  if (!Number.isInteger(likelihood) || !Number.isInteger(severity) || likelihood < 1 || likelihood > 5 || severity < 1 || severity > 5) return null;
  return likelihood * severity;
}

export function trainingSafetyRiskLevel(score: number) {
  if (score >= 20) return "critical" as const;
  if (score >= 13) return "high" as const;
  if (score >= 6) return "medium" as const;
  return "low" as const;
}

export function canApproveTrainingRiskAssessment(input: {
  sessionStatus: string;
  stopWorkRequired: boolean;
  hazardCount: number;
  openHazardCount: number;
  maxResidualRiskScore: number;
}) {
  return input.sessionStatus === "scheduled"
    && !input.stopWorkRequired
    && input.hazardCount > 0
    && input.openHazardCount === 0
    && input.maxResidualRiskScore <= 12;
}

export function canTransitionTrainingSafetyIncident(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return INCIDENT_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function trainingSafetyIncidentClosureReady(input: {
  status: string;
  rootCause?: string | null;
  correctiveActions?: string | null;
  evidenceReference?: string | null;
  closureReview?: string | null;
}) {
  return input.status === "verification"
    && Boolean(input.rootCause?.trim())
    && Boolean(input.correctiveActions?.trim())
    && Boolean(input.evidenceReference?.trim())
    && Boolean(input.closureReview?.trim());
}

export function safetyIncidentRequiresStopWork(severity: string, incidentType: string) {
  return severity === "critical" || severity === "high" || incidentType === "injury" || incidentType === "equipment_failure";
}

export function trainingSafetyValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid training safety data";
}
