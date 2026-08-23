import { PageHeader, Card, Badge } from "@/components/ui";
import { Code, Key, Link as LinkIcon, Terminal } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ApiDocsPage() {
  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Developers"
        title="REST API Documentation"
        description="Integrate external systems with Road Safety Limited. All endpoints require authentication via X-API-Key header or Bearer token."
        action={
          <div className="flex items-center gap-2">
            <Badge tone="blue">v1.0</Badge>
            <Badge tone="emerald">Production</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center"><Key className="h-5 w-5" /></div>
            <h3 className="font-semibold text-slate-950">Authentication</h3>
          </div>
          <p className="text-sm text-slate-600">All API calls require an API key issued by the administrator. Pass it via:</p>
          <pre className="mt-3 rounded-lg bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto">
{`X-API-Key: rsl_live_...
# or
Authorization: Bearer rsl_live_...`}
          </pre>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 grid place-items-center"><LinkIcon className="h-5 w-5" /></div>
            <h3 className="font-semibold text-slate-950">Base URL</h3>
          </div>
          <pre className="mt-3 rounded-lg bg-slate-900 text-slate-100 p-3 text-xs">
{`https://vims.rsl.gh/api/v1`}
          </pre>
          <p className="text-sm text-slate-600 mt-3">All responses are JSON. Rate limit: 1000 req/min per key.</p>
        </Card>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2"><Terminal className="h-5 w-5" /> Endpoints</h2>
        <div className="space-y-3">
          <Endpoint method="GET" path="/api/v1/vehicles" desc="List vehicles with pagination and filters (status, transporter_id)." />
          <Endpoint method="POST" path="/api/v1/vehicles" desc="Create a new vehicle record. Required: registration_number, make." />
          <Endpoint method="GET" path="/api/v1/vehicles/:id" desc="Get a single vehicle by ID." />
          <Endpoint method="PATCH" path="/api/v1/vehicles/:id" desc="Update vehicle fields." />
          <Endpoint method="DELETE" path="/api/v1/vehicles/:id" desc="Delete a vehicle (soft delete preferred)." />
          <Endpoint method="GET" path="/api/v1/transporters" desc="List transporters with region filter." />
          <Endpoint method="GET" path="/api/v1/inspections" desc="List inspections (result, vehicle_id filters)." />
          <Endpoint method="GET" path="/api/v1/inspections/:id" desc="Full inspection record with checklist." />
          <Endpoint method="GET" path="/api/v1/locations" desc="All inspection stations." />
          <Endpoint method="GET" path="/api/v1/stats" desc="Dashboard KPIs (total vehicles, pass rate, etc.)." />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-slate-950 mb-3 flex items-center gap-2"><Code className="h-5 w-5" /> Example Request</h3>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs overflow-x-auto">
{`curl -X GET \\
  "https://vims.rsl.gh/api/v1/vehicles?limit=10&status=active" \\
  -H "X-API-Key: <YOUR_API_KEY>"`}
          </pre>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-slate-950 mb-3 flex items-center gap-2"><Code className="h-5 w-5" /> Example Response</h3>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs overflow-x-auto">
{`{
  "data": [
    {
      "id": "abc-123",
      "registrationNumber": "GT-1234-22",
      "make": "Volvo",
      "model": "9700",
      "status": "active"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 124
  }
}`}
          </pre>
        </Card>
      </div>

      <Card className="p-6 mt-6">
        <h3 className="font-semibold text-slate-950 mb-3">Public Verification</h3>
        <p className="text-sm text-slate-600 mb-3">
          Anyone can verify an inspection certificate by visiting the public verification URL — no authentication required.
          Scan the QR code printed on inspection certificates, or visit:
        </p>
        <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs">
{`https://vims.rsl.gh/verify/<inspection-id-or-number>`}
        </pre>
        <p className="text-xs text-slate-500 mt-2">
          Suitable for traffic police, insurance auditors, and public transparency.
        </p>
      </Card>

      <Card className="p-6 mt-6">
        <h3 className="font-semibold text-slate-950 mb-3">Future Integrations (Planned)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Integration icon="📱" title="Mobile Apps" desc="Android / iOS offline-first inspection apps" />
          <Integration icon="📡" title="GPS Tracking" desc="Live vehicle position from telematics devices" />
          <Integration icon="🤖" title="AI Defect Detection" desc="Computer vision on uploaded inspection photos" />
          <Integration icon="📊" title="Power BI" desc="DirectQuery connector to Power BI datasets" />
          <Integration icon="📑" title="Live Excel Sync" desc="Two-way sync with operational workbooks" />
          <Integration icon="🏷️" title="RFID Integration" desc="Vehicle tagging at inspection stations" />
        </div>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const tone = method === "GET" ? "blue" : method === "POST" ? "emerald" : method === "PATCH" ? "amber" : "red";
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
      <Badge tone={tone as any} className="font-mono">{method}</Badge>
      <code className="font-mono text-sm text-slate-900">{path}</code>
      <span className="text-sm text-slate-600 ml-auto text-right">{desc}</span>
    </div>
  );
}

function Integration({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <p className="font-medium text-slate-900">{title}</p>
      </div>
      <p className="text-xs text-slate-600">{desc}</p>
    </div>
  );
}
