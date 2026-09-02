export const API_SMALL_JSON_BODY_LIMIT = 64 * 1024;
export const API_AI_JSON_BODY_LIMIT = 1024 * 1024;
export const API_INSPECTION_JSON_BODY_LIMIT = 16 * 1024 * 1024;

type JsonBodySuccess = { ok: true; value: unknown; bytes: number };
type JsonBodyFailure = { ok: false; status: 400 | 413; message: string };

function parseDeclaredLength(raw: string | null): number | null | "invalid" {
  if (raw === null) return null;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return "invalid";
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}

export async function readJsonBody(
  request: Request,
  maxBytes: number
): Promise<JsonBodySuccess | JsonBodyFailure> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("maxBytes must be a positive safe integer");
  }

  const declaredLength = parseDeclaredLength(request.headers.get("content-length"));
  if (declaredLength === "invalid") {
    return { ok: false, status: 400, message: "Invalid Content-Length header" };
  }
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { ok: false, status: 413, message: "Request body is too large" };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, message: "JSON request body is required" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        return { ok: false, status: 413, message: "Request body is too large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "Unable to read request body" };
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, message: "JSON request body is required" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 400, message: "Request body must be valid UTF-8 JSON" };
  }

  try {
    return { ok: true, value: JSON.parse(text), bytes: totalBytes };
  } catch {
    return { ok: false, status: 400, message: "Malformed JSON request body" };
  }
}
