import { randomUUID } from "crypto";

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const PRIVATE_BLOB_HOST_SUFFIX = ".private.blob.vercel-storage.com";

export type PrivateBlobUploadResult = {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
  etag: string;
};

type BlobApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Private document storage is not configured");
  return token;
}

function blobStoreId(token: string) {
  const [, , , storeId = ""] = token.split("_");
  if (!storeId) throw new Error("Private document storage token is invalid");
  return storeId;
}

async function blobError(response: Response) {
  let detail = `Vercel Blob request failed with HTTP ${response.status}`;
  try {
    const payload = (await response.json()) as BlobApiError;
    if (payload.error?.message) detail = payload.error.message;
    else if (payload.error?.code) detail = payload.error.code;
  } catch {
    // Keep the status-only message when the upstream response is not JSON.
  }
  return new Error(detail);
}

export function isPrivateBlobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function sanitizePrivateBlobFilename(filename: string) {
  const safe = filename
    .normalize("NFKC")
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return safe || "written-exam-evidence";
}

export async function putPrivateBlob(pathname: string, body: Blob, contentType: string) {
  const token = blobToken();
  const storeId = blobStoreId(token);
  const requestId = `${storeId}:${Date.now()}:${randomUUID()}`;
  const response = await fetch(`${BLOB_API_URL}/?pathname=${encodeURIComponent(pathname)}`, {
    method: "PUT",
    body,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-blob-request-id": requestId,
      "x-api-blob-request-attempt": "0",
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": storeId,
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": contentType,
    },
  });

  if (!response.ok) throw await blobError(response);
  return (await response.json()) as PrivateBlobUploadResult;
}

export async function fetchPrivateBlob(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)) {
    throw new Error("Stored document URL is not an approved private Blob location");
  }

  const response = await fetch(parsed, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${blobToken()}`,
    },
  });

  if (!response.ok) throw await blobError(response);
  return response;
}
