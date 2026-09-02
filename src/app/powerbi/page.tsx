import { requirePermission } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui";
import { PowerBiWorkspace } from "./PowerBiWorkspace";

export const dynamic = "force-dynamic";

function configuredPowerBiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const allowedProtocol = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
      if (allowedProtocol && !url.username && !url.password) return url.origin;
    } catch {
      // Fall through to a safe non-routable placeholder.
    }
  }

  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";

  // Never derive an API destination from Host/X-Forwarded-Host. A spoofed
  // forwarded host must not be able to redirect a user's pasted API key.
  return "https://your-vims-domain.example";
}

export default async function PowerBiPage() {
  await requirePermission("reports");

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Power BI"
        description="Connect, preview VIMS data, and download a Power BI query."
      />
      <PowerBiWorkspace baseUrl={configuredPowerBiBaseUrl()} />
    </div>
  );
}
