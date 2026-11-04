import type { Metadata } from "next";
import { VimsLandingPage } from "@/components/marketing/VimsLandingPage";
import { listSubscriptionPlans } from "@/lib/organization-control-plane";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "VIMS | Vehicle Inspection Management & Subscription Packages",
  description: "Explore the VIMS vehicle inspection, fleet compliance, driver training and reporting platform. Compare current subscription packages and request your organisation's workspace.",
  robots: { index: true, follow: true },
};

export default async function PublicLandingPage() {
  const plans = await listSubscriptionPlans();
  return <VimsLandingPage plans={plans} />;
}
