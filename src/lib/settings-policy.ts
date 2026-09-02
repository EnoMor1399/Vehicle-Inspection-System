import { z } from "zod";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SAFE_LOGO_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_LOGO_DATA_URL_CHARS = 2_800_000;

const nullableText = (max: number) => z
  .union([z.string().trim().max(max), z.null()])
  .transform((value) => value === "" ? null : value);

const nullableEmail = z
  .union([z.string().trim().max(200), z.null()])
  .transform((value) => value === "" ? null : value)
  .refine((value) => value === null || z.string().email().safeParse(value).success, "Email address is invalid");

const nullableHttpUrl = z
  .union([z.string().trim().max(2048), z.null()])
  .transform((value) => value === "" ? null : value)
  .refine((value) => {
    if (value === null) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }, "URL must use http or https");

const logoDataUrl = z
  .union([z.string().max(MAX_LOGO_DATA_URL_CHARS), z.null()])
  .refine((value) => value === null || SAFE_LOGO_DATA_URL.test(value), "Logo must be a bounded PNG, JPEG, or WebP image");

export const systemSettingsUpdateSchema = z.object({
  logoDataUrl,
  logoUrl: nullableHttpUrl,
  companyName: z.string().trim().min(1).max(255),
  companyShortName: z.string().trim().min(1).max(50),
  tagline: nullableText(255),
  themeColor: z.string().regex(HEX_COLOR, "Theme color must be a 6-digit hex color"),
  accentColor: z.string().regex(HEX_COLOR, "Accent color must be a 6-digit hex color"),
  address: nullableText(2000),
  city: nullableText(100),
  region: nullableText(100),
  country: nullableText(100),
  phone: nullableText(50),
  email: nullableEmail,
  website: nullableHttpUrl,
  taxId: nullableText(100),
  registrationNumber: nullableText(100),
  certificateValidityMonths: z.number().int().min(1).max(24),
  reinspectionGraceDays: z.number().int().min(0).max(90),
  requireSupervisorApproval: z.boolean(),
  requireGpsCapture: z.boolean(),
  requireDigitalSignature: z.boolean(),
  certificateHeader: nullableText(2000),
  certificateFooter: nullableText(4000),
  footerText: nullableText(1000),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440),
  passwordMinLength: z.number().int().min(12).max(64),
  passwordRequireUppercase: z.boolean(),
  passwordRequireNumber: z.boolean(),
  maxFailedAttempts: z.number().int().min(1).max(20),
  lockoutDurationMinutes: z.number().int().min(1).max(1440),
  emailNotificationsEnabled: z.boolean(),
  smsNotificationsEnabled: z.boolean(),
  reminderDaysBefore: z.number().int().min(1).max(90),
}).partial().strict();

export type ValidatedSettingsUpdate = z.infer<typeof systemSettingsUpdateSchema>;

export function settingsValidationMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "System settings are invalid";
  const field = first.path.join(".");
  return field ? `${field}: ${first.message}` : first.message;
}
