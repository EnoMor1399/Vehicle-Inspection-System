import { createHmac, timingSafeEqual, createHash } from "crypto";

export interface CertificateFingerprintInput {
  inspectionId: string;
  inspectionNumber: string;
  vehicleRegistration: string;
  inspectionDate: Date | string;
  overallResult: string;
  nextInspectionDate?: Date | string | null;
}

function canonical(input: CertificateFingerprintInput): string {
  const inspectionDate = new Date(input.inspectionDate).toISOString();
  const nextDate = input.nextInspectionDate ? new Date(input.nextInspectionDate).toISOString().slice(0, 10) : "";
  return [
    "vims-certificate-v2",
    input.inspectionId,
    input.inspectionNumber,
    input.vehicleRegistration.trim().toUpperCase(),
    inspectionDate,
    input.overallResult,
    nextDate,
  ].join("|");
}

function signingSecret(): string {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CERTIFICATE_SIGNING_SECRET is required in production");
  }
  return process.env.SESSION_SECRET || "vims-development-certificate-signing-key";
}

export function createCertificateSignature(input: CertificateFingerprintInput): string {
  return createHmac("sha256", signingSecret()).update(canonical(input)).digest("base64url");
}

export function verifyCertificateSignature(input: CertificateFingerprintInput, signature?: string | null): boolean {
  if (!signature) return false;
  try {
    const expected = Buffer.from(createCertificateSignature(input));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function certificateVerificationCode(input: CertificateFingerprintInput): string {
  const digest = createHash("sha256").update(canonical(input)).digest("hex").toUpperCase();
  return `${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}`;
}
