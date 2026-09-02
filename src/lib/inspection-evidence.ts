export const MAX_EVIDENCE_PHOTOS_PER_ITEM = 5;
export const MAX_EVIDENCE_PHOTOS_PER_INSPECTION = 50;
export const MAX_EVIDENCE_PHOTO_DATA_URL_CHARS = 1_500_000;
export const MAX_COMBINED_EVIDENCE_PHOTO_CHARS = 6_000_000;
export const MAX_SIGNATURE_DATA_URL_CHARS = 500_000;
export const MAX_ATTACHED_DOCUMENTS = 5;
export const MAX_ATTACHED_DOCUMENT_BYTES = 1_500_000;
export const MAX_COMBINED_DOCUMENT_BYTES = 3_000_000;

const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const SIGNATURE_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const DOCUMENT_DATA_URL_PATTERN = /^data:(application\/pdf|image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

function decodedBase64Bytes(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function isSupportedEvidenceImageDataUrl(value: string): boolean {
  return value.length <= MAX_EVIDENCE_PHOTO_DATA_URL_CHARS && IMAGE_DATA_URL_PATTERN.test(value);
}

export function isSupportedSignatureDataUrl(value: string): boolean {
  return value.length <= MAX_SIGNATURE_DATA_URL_CHARS && SIGNATURE_DATA_URL_PATTERN.test(value);
}

export function validateSignatureDataUrl(value: string | null | undefined, label = "Signature") {
  if (!value) return;
  if (!isSupportedSignatureDataUrl(value)) {
    throw new Error(`${label} must be a bounded PNG signature image`);
  }
}

export function validateInspectionEvidence(
  sections: Array<{ items?: Array<{ photos?: Array<{ dataUrl?: string }> }> }>
) {
  let totalPhotos = 0;
  let totalCharacters = 0;

  for (const section of sections) {
    for (const item of section.items || []) {
      const photos = item.photos || [];
      if (photos.length > MAX_EVIDENCE_PHOTOS_PER_ITEM) {
        throw new Error(`Each checklist item is limited to ${MAX_EVIDENCE_PHOTOS_PER_ITEM} evidence photos`);
      }
      for (const photo of photos) {
        if (!photo?.dataUrl || !isSupportedEvidenceImageDataUrl(photo.dataUrl)) {
          throw new Error("Evidence photos must be bounded base64 JPEG, PNG, or WebP images");
        }
        totalPhotos += 1;
        totalCharacters += photo.dataUrl.length;
      }
    }
  }

  if (totalPhotos > MAX_EVIDENCE_PHOTOS_PER_INSPECTION) {
    throw new Error(`Inspection evidence is limited to ${MAX_EVIDENCE_PHOTOS_PER_INSPECTION} photos`);
  }
  if (totalCharacters > MAX_COMBINED_EVIDENCE_PHOTO_CHARS) {
    throw new Error("Combined inspection evidence is too large");
  }

  return { totalPhotos, totalCharacters };
}

export function validateDailyInspectionEvidence(
  categories: Array<{ items?: Array<{ photos?: string[] }> }>
) {
  let totalPhotos = 0;
  let totalCharacters = 0;

  for (const category of categories) {
    for (const item of category.items || []) {
      const photos = item.photos || [];
      if (photos.length > MAX_EVIDENCE_PHOTOS_PER_ITEM) {
        throw new Error(`Each checklist item is limited to ${MAX_EVIDENCE_PHOTOS_PER_ITEM} evidence photos`);
      }
      for (const photo of photos) {
        if (!isSupportedEvidenceImageDataUrl(photo)) {
          throw new Error("Evidence photos must be bounded base64 JPEG, PNG, or WebP images");
        }
        totalPhotos += 1;
        totalCharacters += photo.length;
      }
    }
  }

  if (totalPhotos > MAX_EVIDENCE_PHOTOS_PER_INSPECTION) {
    throw new Error(`Inspection evidence is limited to ${MAX_EVIDENCE_PHOTOS_PER_INSPECTION} photos`);
  }
  if (totalCharacters > MAX_COMBINED_EVIDENCE_PHOTO_CHARS) {
    throw new Error("Combined inspection evidence is too large");
  }

  return { totalPhotos, totalCharacters };
}

export function validateInspectionDocuments(
  documents: Array<{ id?: string; name?: string; dataUrl?: string; type?: string; size?: number }>
) {
  if (documents.length > MAX_ATTACHED_DOCUMENTS) {
    throw new Error(`Inspection attachments are limited to ${MAX_ATTACHED_DOCUMENTS} documents`);
  }

  let totalBytes = 0;
  for (const document of documents) {
    if (!document.id || document.id.length > 100) throw new Error("Attachment identifier is invalid");
    if (!document.name || document.name.length > 200 || /[\u0000-\u001f\u007f]/.test(document.name)) {
      throw new Error("Attachment filename is invalid");
    }
    if (!document.dataUrl) throw new Error("Attachment data is required");

    const match = document.dataUrl.match(DOCUMENT_DATA_URL_PATTERN);
    if (!match) throw new Error("Attachments are limited to PDF, JPEG, and PNG files");

    const mimeType = match[1];
    const decodedBytes = decodedBase64Bytes(match[2]);
    if (decodedBytes < 1 || decodedBytes > MAX_ATTACHED_DOCUMENT_BYTES) {
      throw new Error(`Each attachment must be ${MAX_ATTACHED_DOCUMENT_BYTES} bytes or smaller`);
    }
    if (!Number.isSafeInteger(document.size) || document.size !== decodedBytes) {
      throw new Error("Attachment size metadata does not match the encoded file");
    }
    if (document.type && document.type !== mimeType) {
      throw new Error("Attachment MIME type does not match the encoded file");
    }

    totalBytes += decodedBytes;
  }

  if (totalBytes > MAX_COMBINED_DOCUMENT_BYTES) {
    throw new Error("Combined inspection attachments are too large");
  }

  return { totalBytes };
}
