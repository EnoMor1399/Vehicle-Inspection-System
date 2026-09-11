import { z } from "zod";
import { DRIVER_TRAINING_SERVICES } from "./driver-training";

export const TRAINING_REGULATORY_REQUIREMENT_TYPES = [
  "provider_accreditation",
  "trainer_certification",
  "operating_licence",
  "insurance",
  "permit",
  "approved_procedure",
  "equipment_certification",
  "other",
] as const;
export const TRAINING_REGULATORY_REQUIREMENT_STATUSES = ["active", "inactive"] as const;
export const TRAINING_ACCREDITATION_STATUSES = ["pending", "verified", "rejected", "revoked", "superseded"] as const;

const SERVICE_IDS = new Set(DRIVER_TRAINING_SERVICES.map((service) => service.id));
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional().or(z.literal("")).transform((value) => value || undefined);

export const trainingRegulatoryRequirementSchema = z.object({
  requirementCode: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  serviceId: z.string().trim().max(80).optional().or(z.literal("")).transform((value) => value || undefined).refine((value) => !value || SERVICE_IDS.has(value), "Unknown Driver Training service"),
  title: z.string().trim().min(3).max(240),
  authority: z.string().trim().min(2).max(240),
  standardReference: optionalText(240),
  requirementType: z.enum(TRAINING_REGULATORY_REQUIREMENT_TYPES),
  mandatory: z.coerce.boolean().default(true),
  status: z.enum(TRAINING_REGULATORY_REQUIREMENT_STATUSES).default("active"),
  reviewDueDate: optionalDate,
  notes: optionalText(4000),
});

export const trainingAccreditationRecordSchema = z.object({
  requirementId: z.string().uuid(),
  credentialNumber: optionalText(120),
  issuingAuthority: z.string().trim().min(2).max(240),
  issuedDate: optionalDate,
  validFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid start date"),
  validUntil: optionalDate,
  evidenceReference: z.string().trim().min(3).max(500),
}).superRefine((value, ctx) => {
  if (value.validUntil && value.validUntil < value.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Credential expiry cannot be before its validity start" });
  }
  if (value.issuedDate && value.issuedDate > value.validFrom) {
    ctx.addIssue({ code: "custom", path: ["issuedDate"], message: "Issued date cannot be after validity start" });
  }
});

export const trainingAccreditationDecisionSchema = z.object({
  accreditationId: z.string().uuid(),
  status: z.enum(["verified", "rejected", "revoked", "superseded"]),
  verificationNotes: optionalText(4000),
});

export const trainingSessionComplianceReviewSchema = z.object({
  sessionId: z.string().uuid(),
  notes: optionalText(4000),
});

export function trainingAccreditationValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid accreditation data";
}

export function accreditationValidityState(input: { status: string; validFrom: string; validUntil?: string | null }, now = new Date()) {
  if (input.status === "revoked") return "revoked" as const;
  if (input.status === "rejected") return "rejected" as const;
  if (input.status === "superseded") return "superseded" as const;
  if (input.status !== "verified") return "pending" as const;
  const today = now.toISOString().slice(0, 10);
  if (input.validFrom > today) return "not_yet_valid" as const;
  if (input.validUntil && input.validUntil < today) return "expired" as const;
  if (input.validUntil) {
    const days = Math.ceil((new Date(`${input.validUntil}T23:59:59.999Z`).getTime() - now.getTime()) / 86_400_000);
    if (days <= 30) return "expiring" as const;
  }
  return "valid" as const;
}

export type RegulatoryRequirementLike = { id: string; serviceId?: string | null; title: string; mandatory: boolean; status: string };
export type AccreditationLike = { requirementId: string; status: string; validFrom: string; validUntil?: string | null };

export function evaluateTrainingRegulatoryCompliance(
  serviceId: string,
  requirements: RegulatoryRequirementLike[],
  accreditations: AccreditationLike[],
  now = new Date(),
) {
  const applicable = requirements.filter((requirement) => requirement.status === "active" && requirement.mandatory && (!requirement.serviceId || requirement.serviceId === serviceId));
  const blockers: string[] = [];
  for (const requirement of applicable) {
    const satisfied = accreditations.some((record) => record.requirementId === requirement.id && accreditationValidityState(record, now) === "valid");
    if (!satisfied) blockers.push(requirement.title);
  }
  return { ready: blockers.length === 0, blockers, applicableCount: applicable.length };
}
