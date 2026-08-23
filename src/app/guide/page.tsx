import { requireAuth } from "@/lib/require-auth";
import { GuideContent } from "./GuideContent";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  await requireAuth();
  return <GuideContent />;
}
