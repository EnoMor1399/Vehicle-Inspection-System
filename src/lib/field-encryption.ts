import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function keyMaterial(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FIELD_ENCRYPTION_KEY is required in production");
    }
    return createHash("sha256").update("vims-development-field-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptField(value: string): string {
  if (!value) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptField(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value; // legacy plaintext compatibility
  const encoded = value.slice(PREFIX.length);
  const [ivPart, tagPart, dataPart] = encoded.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Encrypted field has invalid format");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
