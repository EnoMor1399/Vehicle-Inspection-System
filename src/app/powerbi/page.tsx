import { headers } from "next/headers";
import { requirePermission } from "@/lib/require-auth";
import { Badge, PageHeader } from "@/components/ui";
import { BarChart3, Database, ShieldCheck } from "lucide-react";
import { PowerBiWorkspace } from "./PowerBiWorkspace";

export const dynamic = "force-dynamic";

export default async function PowerBiPage() {
  await requirePermission("reports");

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const inferredBaseUrl = host ? `${protocol}://${host}` : "https://your-vims-domain.example";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || inferredBaseUrl).replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        title="Power BI Workspace"
        description="Connect Microsoft Power BI to secure VIMS OData data, validate access, build queries, preview results and generate reusable Power Query scripts."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue"><BarChart3 className="h-3.5 w-3.5" /> Power BI</Badge>
            <Badge tone="emerald"><Database className="h-3.5 w-3.5" /> OData v4</Badge>
            <Badge tone="slate"><ShieldCheck className="h-3.5 w-3.5" /> Secured</Badge>
          </div>
        }
      />

      <PowerBiWorkspace baseUrl={baseUrl} />
    </div>
  );
}
