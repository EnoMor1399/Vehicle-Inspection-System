import bcrypt from "bcryptjs";

function boundedIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export const PASSWORD_MIN_LENGTH = boundedIntegerEnv("PASSWORD_MIN_LENGTH", 12, 10, 64);
export const PASSWORD_MAX_LENGTH = 128;
const BCRYPT_ROUNDS = boundedIntegerEnv("PASSWORD_BCRYPT_ROUNDS", 12, 10, 14);

const COMMON_PASSWORDS = new Set([
  "password123!",
  "password1234!",
  "admin123456!",
  "qwerty123456!",
  "welcome12345!",
  "letmein123456!",
]);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  if (password.length > PASSWORD_MAX_LENGTH) errors.push(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) errors.push("Password must include an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password must include a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password must include a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must include a special character");
  if (/\s/.test(password)) errors.push("Password must not contain whitespace");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) errors.push("Choose a less common password");
  return { valid: errors.length === 0, errors };
}

export function validateEmail(email: string): boolean {
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
