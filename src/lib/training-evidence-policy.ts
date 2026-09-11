import { z } from "zod";

export const TRAINING_ATTENDANCE_SIGNOFF_STATUSES = ["open", "confirmed", "disputed", "void"] as const;
export const TRAINING_EVIDENCE_TYPES = [
  "attendance_register",
  "assessment_sheet",
  "practical_observation",
  "client_confirmation",
  "photo_reference",
  "document_reference",
  "other",
] as const;
export const TRAINING_EVIDENCE_STATUSES = ["pending", "verified", "rejected"] as const;

const optionalNotes = z.string().trim().max(4000).optional().transform((value) => value || undefined);

export const trainingAttendanceActionSchema = z.object({
  participantId: z.string().uuid(),
});

export const trainingAttendanceConfirmationSchema = z.object({
  participantId: z.string().uuid(),
  participantAcknowledged: z.coerce.boolean(),
  instructorConfirmed: z.coerce.boolean(),
  notes: optionalNotes,
}).superRefine((value, ctx) => {
  if (!value.participantAcknowledged) {
    ctx.addIssue({ code: "custom", path: ["participantAcknowledged"], message: "Participant acknowledgement must be captured before attendance is confirmed" });
  }
  if (!value.instructorConfirmed) {
    ctx.addIssue({ code: "custom", path: ["instructorConfirmed"], message: "Instructor confirmation is required before attendance is confirmed" });
  }
});

export const trainingAttendanceDisputeSchema = z.object({
  participantId: z.string().uuid(),
  reason: z.string().trim().min(5, "Provide a dispute reason").max(2000),
});

export const trainingEvidenceRecordSchema = z.object({
  sessionId: z.string().uuid(),
  participantId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  evidenceType: z.enum(TRAINING_EVIDENCE_TYPES),
  title: z.string().trim().min(3).max(220),
  reference: z.string().trim().min(2).max(500),
  sha256: z.string().trim().optional().transform((value) => value || undefined).refine(
    (value) => !value || /^[a-f0-9]{64}$/i.test(value),
    "SHA-256 fingerprint must contain exactly 64 hexadecimal characters",
  ),
  reviewNotes: optionalNotes,
});

export const trainingEvidenceVerificationSchema = z.object({
  evidenceId: z.string().uuid(),
  status: z.enum(["verified", "rejected"]),
  reviewNotes: optionalNotes,
}).superRefine((value, ctx) => {
  if (value.status === "rejected" && (!value.reviewNotes || value.reviewNotes.length < 5)) {
    ctx.addIssue({ code: "custom", path: ["reviewNotes"], message: "Provide a reason when rejecting evidence" });
  }
});

export function trainingEvidenceValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 3).map((issue) => issue.message).join("; ") || "Invalid training evidence data";
}

export function calculateAttendanceMinutes(checkInAt?: Date | string | null, checkOutAt?: Date | string | null) {
  if (!checkInAt || !checkOutAt) return 0;
  const start = checkInAt instanceof Date ? checkInAt : new Date(checkInAt);
  const end = checkOutAt instanceof Date ? checkOutAt : new Date(checkOutAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return 0;
  return Math.min(100_000, Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)));
}

export function attendanceSignoffState(input: {
  status?: string | null;
  checkInAt?: Date | string | null;
  checkOutAt?: Date | string | null;
  participantAcknowledged?: boolean | null;
  instructorConfirmed?: boolean | null;
}) {
  if (input.status === "disputed") return "disputed" as const;
  if (input.status === "void") return "void" as const;
  if (input.status === "confirmed") return "confirmed" as const;
  if (!input.checkInAt) return "not_started" as const;
  if (!input.checkOutAt) return "checked_in" as const;
  if (!input.participantAcknowledged || !input.instructorConfirmed) return "awaiting_signoff" as const;
  return "ready_to_confirm" as const;
}

export function evidenceIntegrityState(sha256?: string | null) {
  return sha256 && /^[a-f0-9]{64}$/i.test(sha256) ? "fingerprinted" as const : "reference_only" as const;
}
