import { headers } from "next/headers";
import { requirePermission } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui";
import { PowerBiWorkspace } from "./PowerBiWorkspace";

export const dynamic = "force-dynamic";

function isLocalHost(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return true;
  }
}

export default async function PowerBiPage() {
  await requirePermission("reports");

  const requestHeaders = await headers();
  const forwardedHost = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim();
  const forwardedProto = (requestHeaders.get("x-forwarded-proto") || "https")
    .split(",")[0]
    .trim();
  const requestBaseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
  const configuredBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const baseUrl = (
    requestBaseUrl ||
    (configuredBaseUrl && !isLocalHost(configuredBaseUrl) ? configuredBaseUrl : "https://your-vims-domain.example")
  ).replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Power BI"
        description="Connect, preview VIMS data, and download a Power BI query."
      />
      <PowerBiWorkspace baseUrl={baseUrl} />
    </div>
  );
}
