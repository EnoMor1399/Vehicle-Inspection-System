import { createHash, createHmac, randomBytes } from "crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { newId } from "@/lib/utils";

export function hashApiKey(value: string): string {
  const salt = process.env.API_KEY_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") throw new Error("API_KEY_SALT is required in production");
    return createHash("sha256").update(value).digest("hex");
  }
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function legacyApiKeyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function issueApiKey(input: {
  userId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date | null;
}) {
  const raw = `vims_live_${randomBytes(32).toString("base64url")}`;
  const id = newId();
  await db.insert(apiKeys).values({
    id,
    userId: input.userId,
    name: input.name.trim(),
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, 12),
    scopes: [...new Set(input.scopes)],
    expiresAt: input.expiresAt || null,
    isActive: true,
  });
  return { id, raw, prefix: raw.slice(0, 12) };
}
