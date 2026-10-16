"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  initializePaystackInvoicePayment,
} from "@/lib/subscription-billing";
import { requireOrganizationAccountManager } from "@/lib/require-auth";

export type BillingPaymentActionState = {
  ok: boolean;
  message: string;
  authorizationUrl?: string;
};

function applicationBaseUrl(headerList: Headers) {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");

  const productionHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  if (process.env.NODE_ENV !== "production") {
    const host = headerList.get("host") || "127.0.0.1:3000";
    const protocol = headerList.get("x-forwarded-proto") || "http";
    return `${protocol}://${host}`;
  }

  throw new Error("Configure NEXT_PUBLIC_APP_URL or APP_BASE_URL before enabling online payments");
}

export async function startPaystackInvoicePayment(
  _previous: BillingPaymentActionState,
  formData: FormData,
): Promise<BillingPaymentActionState> {
  const user = await requireOrganizationAccountManager();
  const invoiceId = String(formData.get("invoiceId") || "").trim();
  if (!invoiceId || invoiceId.length > 64) {
    return { ok: false, message: "Invalid invoice reference." };
  }
  if (!user.email) {
    return { ok: false, message: "Your account requires a billing email before online payment can start." };
  }

  try {
    const headerList = await headers();
    const result = await initializePaystackInvoicePayment({
      organizationId: user.organizationId,
      invoiceId,
      userId: user.id,
      payerEmail: user.email,
      appBaseUrl: applicationBaseUrl(headerList),
    });
    revalidatePath("/organization/billing");
    return {
      ok: true,
      message: "Secure checkout is ready.",
      authorizationUrl: result.authorizationUrl,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to start online payment.",
    };
  }
}
