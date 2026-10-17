import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { platformContent } from "@/db/schema";

type ContentEntry = { key: string; label: string; area: string; defaultText: string; maxLength: number };

export const PLATFORM_CONTENT_FIELDS = [
  { key: "login.eyebrow", label: "Login section label", area: "Sign in", defaultText: "Enterprise operations", maxLength: 100 },
  { key: "login.headline", label: "Sign-in headline", area: "Sign in", defaultText: "Controlled inspection operations in one secure workspace.", maxLength: 180 },
  { key: "login.description", label: "Sign-in description", area: "Sign in", defaultText: "Manage vehicle records, inspections, approvals, certificates, compliance reporting, and audit history with clear operational controls.", maxLength: 600 },
  { key: "login.subscription_title", label: "Company subscription heading", area: "Sign in", defaultText: "Need VIMS for another company?", maxLength: 150 },
  { key: "login.subscription_description", label: "Company subscription description", area: "Sign in", defaultText: "Request a dedicated organization subscription with its own branding, administrators, plan limits and controlled tenant provisioning.", maxLength: 500 },
  { key: "subscribe.badge", label: "Subscription label", area: "Subscription page", defaultText: "Multi-organization VIMS", maxLength: 100 },
  { key: "subscribe.headline", label: "Subscription headline", area: "Subscription page", defaultText: "A dedicated VIMS workspace for your organization.", maxLength: 180 },
  { key: "subscribe.description", label: "Subscription introduction", area: "Subscription page", defaultText: "Subscribe with organization-specific branding, administrators, modules and capacity limits. Vehicle Inspection and Driver Training administrations remain separate, while subscription ownership is managed independently.", maxLength: 750 },
  { key: "subscribe.benefit_1", label: "Benefit 1", area: "Subscription page", defaultText: "Isolated organization identity and controlled provisioning", maxLength: 200 },
  { key: "subscribe.benefit_2", label: "Benefit 2", area: "Subscription page", defaultText: "Vehicle Inspection and Driver Training administration separation", maxLength: 200 },
  { key: "subscribe.benefit_3", label: "Benefit 3", area: "Subscription page", defaultText: "Subscription plans with user, station, vehicle and inspection limits", maxLength: 200 },
  { key: "subscribe.benefit_4", label: "Benefit 4", area: "Subscription page", defaultText: "Organization-specific branding, security and notification settings", maxLength: 200 },
  { key: "subscribe.benefit_5", label: "Benefit 5", area: "Subscription page", defaultText: "One-time administrator invitations with expiring tokens", maxLength: 200 },
  { key: "subscribe.benefit_6", label: "Benefit 6", area: "Subscription page", defaultText: "Operational access unlocked only after tenant isolation verification", maxLength: 200 },
  { key: "subscribe.security_note", label: "Subscription security note", area: "Subscription page", defaultText: "Subscription approval does not bypass security review. A new company cannot see RSL or another subscriber’s operational records while provisioning is incomplete.", maxLength: 600 },
  { key: "workspace.setup_title", label: "Workspace progress heading", area: "Workspace access", defaultText: "Onboarding progress", maxLength: 150 },
  { key: "subscription.access_description", label: "Unavailable module explanation", area: "Workspace access", defaultText: "Your organization can only use operational modules included in its current VIMS subscription plan.", maxLength: 500 },
] as const satisfies readonly ContentEntry[];

export type PlatformContentKey = typeof PLATFORM_CONTENT_FIELDS[number]["key"];
export const PLATFORM_CONTENT_BY_KEY = Object.fromEntries(PLATFORM_CONTENT_FIELDS.map(field => [field.key, field])) as Record<PlatformContentKey, typeof PLATFORM_CONTENT_FIELDS[number]>;

export async function getPublishedPlatformContent() {
  const keys = PLATFORM_CONTENT_FIELDS.map(item => item.key);
  let rows: { key: string; publishedText: string | null }[] = [];
  try {
    rows = await db.select({ key: platformContent.key, publishedText: platformContent.publishedText })
      .from(platformContent).where(inArray(platformContent.key, keys));
  } catch (error) {
    // Preserve public sign-in and subscription pages during additive migration rollout.
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
    if (!cause || typeof cause !== "object" || !("code" in cause)
        || String(cause.code) !== "42P01") throw error;
  }
  const published = new Map(rows.map(row => [row.key, row.publishedText]));
  return Object.fromEntries(PLATFORM_CONTENT_FIELDS.map(field =>
    [field.key, published.get(field.key) || field.defaultText],
  )) as Record<PlatformContentKey, string>;
}

export async function listPlatformContentDrafts() {
  const rows = await db.select().from(platformContent);
  const existing = new Map(rows.map(row => [row.key, row]));
  return PLATFORM_CONTENT_FIELDS.map(field => ({
    ...field,
    draft: existing.get(field.key)?.draftText ?? field.defaultText,
    published: existing.get(field.key)?.publishedText ?? null,
    revision: existing.get(field.key)?.revision ?? 0,
    publishedAt: existing.get(field.key)?.publishedAt ?? null,
    updatedAt: existing.get(field.key)?.updatedAt ?? null,
  }));
}
