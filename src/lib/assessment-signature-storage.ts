import { randomUUID } from "crypto";
import { isPrivateBlobStorageConfigured, putPrivateBlob } from "@/lib/private-blob-storage";

export type AssessmentSignatureKind = "assessor" | "reviewer";

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

export function assessmentSignaturePath(
  assessmentId: string,
  kind: AssessmentSignatureKind,
  storedValue: string | null | undefined,
): string | null {
  if (!storedValue) return null;
  return `/api/driver-training/assessment-signatures/${assessmentId}/${kind}`;
}

export function decodePngSignatureDataUrl(value: string): ArrayBuffer | null {
  const match = value.match(PNG_DATA_URL);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64");
  return decoded.buffer.slice(
    decoded.byteOffset,
    decoded.byteOffset + decoded.byteLength,
  ) as ArrayBuffer;
}

export async function moveAssessmentSignatureToPrivateStorage(
  assessmentId: string,
  kind: AssessmentSignatureKind,
  currentValue: string,
): Promise<{ value: string; storage: "private_blob" | "database_data_url" }> {
  if (!currentValue.startsWith("data:") || !isPrivateBlobStorageConfigured()) {
    return { value: currentValue, storage: currentValue.startsWith("data:") ? "database_data_url" : "private_blob" };
  }

  const bytes = decodePngSignatureDataUrl(currentValue);
  if (!bytes?.byteLength) return { value: currentValue, storage: "database_data_url" };

  try {
    const pathname = [
      "driver-training",
      "assessments",
      assessmentId,
      "signatures",
      `${kind}-${randomUUID()}.png`,
    ].join("/");
    const blob = new Blob([bytes], { type: "image/png" });
    const uploaded = await putPrivateBlob(pathname, blob, "image/png");
    return { value: uploaded.url, storage: "private_blob" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown private storage error";
    console.warn(`[assessment-signature] private storage migration failed for ${kind}: ${message}`);
    return { value: currentValue, storage: "database_data_url" };
  }
}
