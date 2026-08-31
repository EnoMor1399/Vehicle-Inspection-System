export const API_DEFAULT_PAGE_SIZE = 50;
export const API_MAX_PAGE_SIZE = 100;
export const API_MAX_OFFSET = 100_000;

type PaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  maxOffset?: number;
};

export type ApiPagination = {
  ok: true;
  limit: number;
  offset: number;
};

export type ApiPaginationError = {
  ok: false;
  message: string;
};

function parseInteger(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
  label: string
): number | string {
  if (raw === null || raw.trim() === "") return fallback;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return `${label} must be a whole number between ${min} and ${max}`;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    return `${label} must be between ${min} and ${max}`;
  }
  return parsed;
}

export function parseApiPagination(
  params: URLSearchParams,
  options: PaginationOptions = {}
): ApiPagination | ApiPaginationError {
  const defaultLimit = options.defaultLimit ?? API_DEFAULT_PAGE_SIZE;
  const maxLimit = options.maxLimit ?? API_MAX_PAGE_SIZE;
  const maxOffset = options.maxOffset ?? API_MAX_OFFSET;

  const limit = parseInteger(params.get("limit"), defaultLimit, 1, maxLimit, "limit");
  if (typeof limit === "string") return { ok: false, message: limit };

  const offset = parseInteger(params.get("offset"), 0, 0, maxOffset, "offset");
  if (typeof offset === "string") return { ok: false, message: offset };

  return { ok: true, limit, offset };
}
