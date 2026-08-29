import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Code, Key, Link as LinkIcon, ShieldCheck, Terminal } from "lucide-react";
import { requirePermission } from "@/lib/require-auth";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { ApiKeyManager } from "./ApiKeyManager";

export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  const user = await requirePermission("settings");
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "your-vims-domain.example";
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const configuredBase = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const appBase = configuredBase || `${forwardedProto}://${forwardedHost}`;
  const apiBase = `${appBase}/api/v1`;
  const apiLimit = Math.max(1, Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100));
  const apiWindowMs = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60000));
  const apiWindowSeconds = Math.ceil(apiWindowMs / 1000);

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));

  const initialKeys = rows.map((row) => ({
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes || [],
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt?.toISOString() || null,
    expiresAt: row.expiresAt?.toISOString() || null,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        title="API & Integrations"
        description="Generate secure API keys, connect Power BI and approved integrations, and review the authenticated VIMS interfaces available to your account."
        action={<div className="flex items-center gap-2"><Badge tone="blue">API v1</Badge><Badge tone="emerald"><ShieldCheck className="h-3.5 w-3.5" /> Scoped access</Badge></div>}
      />

      <div id="api-keys" className="mb-6 scroll-mt-24">
        <ApiKeyManager initialKeys={initialKeys} isSuperAdmin={user.role === "super_admin"} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><Key className="h-5 w-5" /></div>
            <div><h2 className="font-semibold text-slate-950">Authentication</h2><p className="text-xs text-slate-500">Use an active API key with the required scope and user permission.</p></div>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`X-API-Key: <YOUR_API_KEY>\n# or\nAuthorization: Bearer <YOUR_API_KEY>`}</pre>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">Keys are hashed at rest, can be revoked or expired, and are restricted by scopes such as <code>read</code>, <code>write</code>, <code>inspect</code>, or <code>admin</code>. Power BI only needs <code>read</code>.</p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><LinkIcon className="h-5 w-5" /></div>
            <div><h2 className="font-semibold text-slate-950">Deployment endpoint</h2><p className="text-xs text-slate-500">Derived from the configured application URL.</p></div>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{apiBase}</pre>
          <p className="mt-3 text-xs text-slate-600">Configured API rate limit: <strong>{apiLimit}</strong> requests per <strong>{apiWindowSeconds} seconds</strong> per rate-limit identity. Vercel or upstream infrastructure may enforce additional limits.</p>
        </Card>
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-950"><Terminal className="h-5 w-5" /> Available interfaces</h2>
        <div className="space-y-2">
          <Endpoint method="GET" path="/vehicles" desc="List vehicles using authenticated read access." />
          <Endpoint method="POST" path="/vehicles" desc="Create a vehicle with write permission." />
          <Endpoint method="GET" path="/vehicles/:id" desc="Retrieve a vehicle by identifier." />
          <Endpoint method="PATCH" path="/vehicles/:id" desc="Update approved vehicle fields." />
          <Endpoint method="DELETE" path="/vehicles/:id" desc="Decommission a vehicle while preserving history." />
          <Endpoint method="GET" path="/transporters" desc="Read transporter records permitted by the API credential." />
          <Endpoint method="GET" path="/inspections" desc="Read inspection records and supported filters." />
          <Endpoint method="POST" path="/inspections" desc="Create an inspection through the validated inspection API." />
          <Endpoint method="GET" path="/inspections/:id" desc="Retrieve an inspection record." />
          <Endpoint method="GET" path="/locations" desc="Read configured inspection stations." />
          <Endpoint method="GET" path="/stats" desc="Read operational summary metrics." />
          <Endpoint method="GET" path="/rfid" desc="Resolve registered RFID tag data where authorized." />
          <Endpoint method="GET" path="/predictive-maintenance" desc="Historical maintenance-risk indicators; not an exact failure prediction." />
          <Endpoint method="POST" path="/ai/detect-defects" desc="Historical defect-risk compatibility endpoint; image computer vision is not configured in this release." />
          <Endpoint method="GET" path="/powerbi" desc="OData v4 reporting endpoint with technical, Pre-Trip and permission-based datasets." />
          <Endpoint method="POST" path="/webhooks" desc="Manage outbound webhook registrations subject to destination validation." />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><Code className="h-5 w-5" /> Example request</h3>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{`curl -X GET \\\n  "${apiBase}/vehicles?limit=10&status=active" \\\n  -H "X-API-Key: <YOUR_API_KEY>"`}</pre>
        </Card>
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 font-semibold text-slate-950">Operational safeguards</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• API-key scope plus user-permission checks.</li>
            <li>• Full key value is shown only once and only a cryptographic hash is stored.</li>
            <li>• Request rate limiting and request identifiers.</li>
            <li>• Origin checks and body-size limits on mutating API requests.</li>
            <li>• Validated webhook destinations to reduce SSRF exposure.</li>
            <li>• Power BI filter/order/select allowlists instead of unrestricted SQL fragments.</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <h3 className="font-semibold text-slate-950">Public certificate verification</h3>
        <p className="mt-2 text-sm text-slate-600">Issued certificates contain a signed QR verification URL. The public verification page does not require a user session, but signed certificate data and current validity are checked by the application.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{`${appBase}/verify/<inspection-id>?sig=<signed-token>`}</pre>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const tone = method === "GET" ? "blue" : method === "POST" ? "emerald" : method === "PATCH" ? "amber" : "red";
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[76px_minmax(180px,1fr)_2fr] sm:items-center">
      <Badge tone={tone as "blue" | "emerald" | "amber" | "red"} className="justify-center font-mono">{method}</Badge>
      <code className="break-all font-mono text-xs text-slate-900">{path}</code>
      <span className="text-xs leading-relaxed text-slate-600 sm:text-sm">{desc}</span>
    </div>
  );
}
