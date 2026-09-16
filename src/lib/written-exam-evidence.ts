import { sanitizePrivateBlobFilename } from "@/lib/private-blob-storage";

export const WRITTEN_EXAM_OWNER_TYPE = "training_assessment";
export const WRITTEN_EXAM_DOCUMENT_PREFIX = "Written Exam · ";
export const WRITTEN_EXAM_MAX_FILE_BYTES = 4_000_000;

export const WRITTEN_EXAM_EVIDENCE_TYPES = {
  theory: "Theory paper",
  road_signs: "Road Signs paper",
  marking_sheet: "Marking / result sheet",
  answer_script: "Answer script",
  other: "Other evidence",
} as const;

export type WrittenExamEvidenceType = keyof typeof WRITTEN_EXAM_EVIDENCE_TYPES;

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export function isWrittenExamEvidenceType(value: string): value is WrittenExamEvidenceType {
  return Object.prototype.hasOwnProperty.call(WRITTEN_EXAM_EVIDENCE_TYPES, value);
}

export function writtenExamEvidenceLabel(value: string) {
  return isWrittenExamEvidenceType(value) ? WRITTEN_EXAM_EVIDENCE_TYPES[value] : "Other evidence";
}

export function writtenExamFileExtension(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function validateWrittenExamFileMetadata(file: { name: string; type: string; size: number }) {
  if (!file.name.trim()) return "Select a file to upload";
  if (!Number.isFinite(file.size) || file.size <= 0) return "The selected file is empty";
  if (file.size > WRITTEN_EXAM_MAX_FILE_BYTES) return "Each written exam file must be 4 MB or smaller";

  const extensions = ALLOWED_FILE_TYPES[file.type];
  if (!extensions) return "Only PDF, JPEG, PNG and WebP written exam files are allowed";
  if (!extensions.includes(writtenExamFileExtension(file.name))) {
    return "The file extension does not match its declared file type";
  }
  return null;
}

export async function validateWrittenExamFileSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = new TextDecoder("ascii").decode(bytes);
  const matches =
    (file.type === "application/pdf" && ascii.startsWith("%PDF-")) ||
    (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (file.type === "image/png" && bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG") ||
    (file.type === "image/webp" && ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP");
  return matches ? null : "The uploaded file content does not match its declared file type";
}

export function buildWrittenExamDocumentName(type: WrittenExamEvidenceType, originalFilename: string) {
  return `${WRITTEN_EXAM_DOCUMENT_PREFIX}${WRITTEN_EXAM_EVIDENCE_TYPES[type]} · ${sanitizePrivateBlobFilename(originalFilename)}`.slice(0, 255);
}

export function isWrittenExamDocumentName(name: string) {
  return name.startsWith(WRITTEN_EXAM_DOCUMENT_PREFIX);
}

export function writtenExamOriginalFilename(name: string) {
  if (!isWrittenExamDocumentName(name)) return name;
  const parts = name.split(" · ");
  return parts.length >= 3 ? parts.slice(2).join(" · ") : name.slice(WRITTEN_EXAM_DOCUMENT_PREFIX.length);
}

export function writtenExamBlobPath(assessmentId: string, type: WrittenExamEvidenceType, originalFilename: string) {
  const safeName = sanitizePrivateBlobFilename(originalFilename);
  return `driver-training/written-exams/${assessmentId}/${type}/${crypto.randomUUID()}-${safeName}`;
}
