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

type PrivateBlobAuthOptions = {
  oidcToken?: string | null;
};

type PrivateBlobAuth = {
  token: string;
  storeId: string;
  mode: "oidc" | "read_write_token";
};

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeStoreId(storeId: string) {
  const value = storeId.trim();
  return value.startsWith("store_") ? value.slice("store_".length) : value;
}

function blobStoreIdFromReadWriteToken(token: string) {
  const [, , , storeId = ""] = token.split("_");
  const normalized = normalizeStoreId(storeId);
  if (!normalized) throw new Error("Private document storage token is invalid");
  return normalized;
}

function resolvePrivateBlobAuth(options?: PrivateBlobAuthOptions): PrivateBlobAuth {
  const linkedStoreId = normalizeStoreId(readEnv("BLOB_STORE_ID"));
  const oidcToken = options?.oidcToken?.trim() || readEnv("VERCEL_OIDC_TOKEN");

  if (linkedStoreId && oidcToken) {
    return { token: oidcToken, storeId: linkedStoreId, mode: "oidc" };
  }

  const readWriteToken = readEnv("BLOB_READ_WRITE_TOKEN");
  if (readWriteToken) {
    return {
      token: readWriteToken,
      storeId: blobStoreIdFromReadWriteToken(readWriteToken),
      mode: "read_write_token",
    };
  }

  if (linkedStoreId) {
    throw new Error("Private document storage is connected, but Vercel OIDC credentials are unavailable in this runtime");
  }

  throw new Error("Private document storage is not configured");
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
  return Boolean(readEnv("BLOB_STORE_ID") || readEnv("BLOB_READ_WRITE_TOKEN"));
}

export function privateBlobStorageAuthMode() {
  if (readEnv("BLOB_STORE_ID")) return "oidc" as const;
  if (readEnv("BLOB_READ_WRITE_TOKEN")) return "read_write_token" as const;
  return "unconfigured" as const;
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

export async function putPrivateBlob(
  pathname: string,
  body: Blob,
  contentType: string,
  options?: PrivateBlobAuthOptions,
) {
  const auth = resolvePrivateBlobAuth(options);
  const requestId = `${auth.storeId}:${Date.now()}:${randomUUID()}`;
  const response = await fetch(`${BLOB_API_URL}/?pathname=${encodeURIComponent(pathname)}`, {
    method: "PUT",
    body,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${auth.token}`,
      "x-api-blob-request-id": requestId,
      "x-api-blob-request-attempt": "0",
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": auth.storeId,
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": contentType,
    },
  });

  if (!response.ok) throw await blobError(response);
  return (await response.json()) as PrivateBlobUploadResult;
}

export async function fetchPrivateBlob(url: string, options?: PrivateBlobAuthOptions) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(PRIVATE_BLOB_HOST_SUFFIX)) {
    throw new Error("Stored document URL is not an approved private Blob location");
  }

  const auth = resolvePrivateBlobAuth(options);
  const response = await fetch(parsed, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) throw await blobError(response);
  return response;
}
