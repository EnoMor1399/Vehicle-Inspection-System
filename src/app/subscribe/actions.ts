"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { clientIpFromHeaders } from "@/lib/request-context";
import { rateLimit } from "@/lib/rate-limit";
import { createOnboardingRequest } from "@/lib/organization-control-plane";

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(255),
  contactName: z.string().trim().min(2).max(200),
  contactEmail: z.string().trim().email().max(200),
  contactPhone: z.string().trim().max(50).optional(),
  country: z.string().trim().min(2).max(100),
  industry: z.string().trim().max(120).optional(),
  estimatedUsers: z.coerce.number().int().min(1).max(100000).optional(),
  estimatedVehicles: z.coerce.number().int().min(0).max(10000000).optional(),
  desiredPlanCode: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(4000).optional(),
  website: z.string().max(0).optional(), // honeypot
});

export type SubscriptionRequestState = {
  ok: boolean;
  message: string;
  requestId?: string;
};

export async function submitSubscriptionRequest(
  _previous: SubscriptionRequestState,
  formData: FormData,
): Promise<SubscriptionRequestState> {
  const parsed = onboardingSchema.safeParse({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") || undefined,
    country: formData.get("country") || "Ghana",
    industry: formData.get("industry") || undefined,
    estimatedUsers: formData.get("estimatedUsers") || undefined,
    estimatedVehicles: formData.get("estimatedVehicles") || undefined,
    desiredPlanCode: formData.get("desiredPlanCode") || undefined,
    notes: formData.get("notes") || undefined,
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Please review the form." };
  }
  if (parsed.data.website) {
    return { ok: true, message: "Your request has been received." };
  }

  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const limit = await rateLimit("signup", `subscription:${ip}`);
  if (!limit.allowed) {
    return { ok: false, message: "Too many subscription requests. Please try again later." };
  }

  const sourceIpHash = createHash("sha256").update(ip).digest("hex");
  try {
    const requestId = await createOnboardingRequest({
      companyName: parsed.data.companyName,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      country: parsed.data.country,
      industry: parsed.data.industry,
      estimatedUsers: parsed.data.estimatedUsers,
      estimatedVehicles: parsed.data.estimatedVehicles,
      desiredPlanCode: parsed.data.desiredPlanCode,
      requestedModules: formData.getAll("requestedModules").map(String).slice(0, 10),
      notes: parsed.data.notes,
      sourceIpHash,
    });

    return {
      ok: true,
      requestId,
      message: "Subscription request received. A platform administrator will review the company workspace before activation.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to submit the request.",
    };
  }
}
