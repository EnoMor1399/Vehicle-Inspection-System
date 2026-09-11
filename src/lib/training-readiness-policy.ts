import { z } from "zod";

export const TRAINING_INSTRUCTOR_STATUSES = ["active", "inactive", "suspended"] as const;
export const TRAINING_READINESS_STATUSES = ["not_ready", "blocked", "ready"] as const;

const optionalDate = z.string().trim().max(20).optional().transform((value) => value || undefined).refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Use a valid date"
);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const trainingInstructorProfileSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(TRAINING_INSTRUCTOR_STATUSES).default("active"),
  specialties: z.string().trim().max(4000).optional().transform((value) =>
    value ? [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30) : []
  ),
  driverLicenseNumber: optionalText(100),
  driverLicenseExpiry: optionalDate,
  trainerCertification: optionalText(220),
  trainerCertificationExpiry: optionalDate,
  firstAidExpiry: optionalDate,
  medicalFitnessExpiry: optionalDate,
  notes: optionalText(4000),
});

export const trainingSessionReadinessSchema = z.object({
  sessionId: z.string().uuid(),
  instructorConfirmed: z.boolean(),
  venueConfirmed: z.boolean(),
  vehicleEquipmentReady: z.boolean(),
  trainingMaterialsReady: z.boolean(),
  participantListConfirmed: z.boolean(),
  riskAssessmentComplete: z.boolean(),
  emergencyPlanConfirmed: z.boolean(),
  clientConfirmationReceived: z.boolean(),
  blockers: z.string().trim().max(4000).optional().transform((value) =>
    value ? [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30) : []
  ),
  notes: optionalText(4000),
});

export function trainingReadinessValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 3).map((issue) => issue.message).join("; ") || "Invalid training readiness data";
}

export type TrainingReadinessControls = {
  instructorConfirmed: boolean;
  venueConfirmed: boolean;
  vehicleEquipmentReady: boolean;
  trainingMaterialsReady: boolean;
  participantListConfirmed: boolean;
  riskAssessmentComplete: boolean;
  emergencyPlanConfirmed: boolean;
  clientConfirmationReceived: boolean;
  blockers?: readonly string[] | null;
};

export function evaluateTrainingReadiness(input: TrainingReadinessControls) {
  const controls = [
    input.instructorConfirmed,
    input.venueConfirmed,
    input.vehicleEquipmentReady,
    input.trainingMaterialsReady,
    input.participantListConfirmed,
    input.riskAssessmentComplete,
    input.emergencyPlanConfirmed,
    input.clientConfirmationReceived,
  ];
  const completed = controls.filter(Boolean).length;
  const total = controls.length;
  const blockers = (input.blockers || []).filter(Boolean);
  const status = blockers.length > 0 ? "blocked" : completed === total ? "ready" : "not_ready";
  return {
    status: status as "blocked" | "ready" | "not_ready",
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function trainingCredentialState(expiryDates: Array<string | Date | null | undefined>, now = new Date(), warningDays = 60) {
  const validDates = expiryDates
    .filter((value): value is string | Date => Boolean(value))
    .map((value) => value instanceof Date ? value : new Date(`${value}T23:59:59.999Z`))
    .filter((value) => !Number.isNaN(value.getTime()));
  if (validDates.length === 0) return "incomplete" as const;
  const warningCutoff = new Date(now);
  warningCutoff.setUTCDate(warningCutoff.getUTCDate() + warningDays);
  if (validDates.some((value) => value.getTime() < now.getTime())) return "expired" as const;
  if (validDates.some((value) => value.getTime() <= warningCutoff.getTime())) return "expiring" as const;
  return "current" as const;
}

export function instructorDeploymentState(input: {
  status: string;
  trainerCertificationExpiry?: string | Date | null;
  medicalFitnessExpiry?: string | Date | null;
  driverLicenseExpiry?: string | Date | null;
  firstAidExpiry?: string | Date | null;
}, now = new Date()) {
  if (input.status !== "active") return "unavailable" as const;
  const credential = trainingCredentialState([
    input.trainerCertificationExpiry,
    input.medicalFitnessExpiry,
    input.driverLicenseExpiry,
    input.firstAidExpiry,
  ], now);
  if (credential === "expired") return "blocked" as const;
  if (credential === "expiring") return "attention" as const;
  if (credential === "incomplete") return "incomplete" as const;
  return "ready" as const;
}
