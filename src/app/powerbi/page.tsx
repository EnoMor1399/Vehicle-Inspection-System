import { requireAuth } from "@/lib/require-auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import { BarChart3, CheckCircle2, Database, Key, Link2, Shield, Code, Download } from "lucide-react";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vims.rsl.gh";

export default async function PowerBiPage() {
  await requireAuth();

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Business Intelligence"
        title="Power BI DirectQuery Connector"
        description="Connect Microsoft Power BI directly to VIMS data using our OData v4 compliant endpoint. Build dashboards, reports, and data models with live data."
        action={
          <div className="flex items-center gap-2">
            <Badge tone="emerald">OData v4.0</Badge>
            <Badge tone="blue">DirectQuery</Badge>
          </div>
        }
      />

      {/* Quick Start */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Quick Start — Connect Power BI
        </h2>
        <ol className="space-y-3 text-sm">
          <Step n={1}>Open <strong>Power BI Desktop</strong> → <strong>Get Data</strong> → <strong>OData Feed</strong></Step>
          <Step n={2}>
            Paste the service URL:
            <CopyBlock value={`${BASE_URL}/api/v1/powerbi`} />
          </Step>
          <Step n={3}>
            Under <strong>Advanced options</strong>, add HTTP header for authentication:
            <CopyBlock value={`X-API-Key: <YOUR_API_KEY>`} mono />
          </Step>
          <Step n={4}>Select the datasets you need (Inspections, Vehicles, Defects, etc.) and click <strong>Load</strong></Step>
          <Step n={5}>Start building reports with live data — Power BI will query VIMS on-demand</Step>
        </ol>
      </Card>

      {/* Available Datasets */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Database className="h-5 w-5" /> Available Datasets
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-4 text-left">Entity</th>
                <th className="py-2 pr-4 text-left">Description</th>
                <th className="py-2 pr-4 text-left">Key Fields</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              <DatasetRow name="Inspections" desc="All inspections with results, inspector, station, vehicle" fields="InspectionNumber, OverallResult, InspectionDate, VehicleRegistration" url={`${BASE_URL}/api/v1/powerbi?path=Inspections`} />
              <DatasetRow name="Vehicles" desc="Complete vehicle register with transporter, status, expiries" fields="RegistrationNumber, Make, Model, Status, TotalInspections" url={`${BASE_URL}/api/v1/powerbi?path=Vehicles`} />
              <DatasetRow name="Transporters" desc="Transporter companies with fleet size and compliance counts" fields="CompanyName, Region, FleetSize, PassCount, FailCount" url={`${BASE_URL}/api/v1/powerbi?path=Transporters`} />
              <DatasetRow name="Stations" desc="Inspection centers with capacity and performance metrics" fields="Name, Region, Capacity, InspectionCount" url={`${BASE_URL}/api/v1/powerbi?path=Stations`} />
              <DatasetRow name="Defects" desc="All failed inspection items with severity and photos" fields="SectionCode, ItemName, Severity, Remarks, PhotoCount" url={`${BASE_URL}/api/v1/powerbi?path=Defects`} />
              <DatasetRow name="Documents" desc="Uploaded documents with version, expiry, uploader" fields="Name, Type, ExpiryDate, UploadedBy" url={`${BASE_URL}/api/v1/powerbi?path=Documents`} />
              <DatasetRow name="AuditLogs" desc="Immutable audit trail for security and compliance" fields="Action, EntityType, UserName, Summary" url={`${BASE_URL}/api/v1/powerbi?path=AuditLogs`} />
              <DatasetRow name="Users" desc="User accounts with roles, stations, last login" fields="Name, Email, Role, StationName" url={`${BASE_URL}/api/v1/powerbi?path=Users`} />
            </tbody>
          </table>
        </div>
      </Card>

      {/* OData Query Examples */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Code className="h-5 w-5" /> OData Query Examples
        </h2>
        <div className="space-y-3">
          <QueryExample
            title="Failed inspections only"
            url={`${BASE_URL}/api/v1/powerbi?path=Inspections?$filter=OverallResult eq 'fail'&$top=50`}
          />
          <QueryExample
            title="Vehicles in Greater Accra region"
            url={`${BASE_URL}/api/v1/powerbi?path=Vehicles?$filter=TransporterRegion eq 'Greater Accra'`}
          />
          <QueryExample
            title="Critical defects from last 30 days"
            url={`${BASE_URL}/api/v1/powerbi?path=Defects?$filter=Severity eq 'critical'&$orderby=InspectionDate desc&$top=100`}
          />
          <QueryExample
            title="Select specific fields"
            url={`${BASE_URL}/api/v1/powerbi?path=Inspections?$select=InspectionNumber,OverallResult,VehicleRegistration`}
          />
          <QueryExample
            title="Count + paginated"
            url={`${BASE_URL}/api/v1/powerbi?path=Vehicles?$count=true&$top=25&$skip=0`}
          />
        </div>
      </Card>

      {/* Authentication */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Key className="h-5 w-5" /> Authentication
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          All Power BI queries require an API key. Include it in the <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono">X-API-Key</code> HTTP header.
        </p>
        <div className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto mb-3">
{`# In Power BI: Get Data → OData Feed → Advanced
URL: ${BASE_URL}/api/v1/powerbi
HTTP Headers:
  X-API-Key: <YOUR_API_KEY>`}
        </div>
        <p className="text-xs text-slate-500">
          API keys are managed by administrators. Contact your admin to issue or rotate keys.
        </p>
      </Card>

      {/* Metadata */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" /> Schema Discovery ($metadata)
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          Power BI automatically reads the EDMX schema from our <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono">$metadata</code> endpoint to understand field types and relationships.
        </p>
        <CopyBlock value={`${BASE_URL}/api/v1/powerbi/$metadata`} />
        <p className="text-xs text-slate-500 mt-2">
          Returns OData v4 EDMX XML with full EntityType definitions for all 8 datasets.
        </p>
      </Card>

      {/* Sample Queries */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Sample Power BI Reports You Can Build
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <ReportIdea title="Fleet Compliance Dashboard" desc="Pass rate by transporter, region, and month" />
          <ReportIdea title="Defect Heat Map" desc="Most common failures by vehicle category" />
          <ReportIdea title="Inspector Productivity" desc="Inspections per inspector with pass rates" />
          <ReportIdea title="Expiry Forecast" desc="Upcoming certificate expirations over next 90 days" />
          <ReportIdea title="Station Performance" desc="Compare inspection volumes and outcomes across stations" />
          <ReportIdea title="Audit Security Report" desc="Failed logins, deletions, and suspicious activity" />
        </div>
      </Card>

      {/* Response Format */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <Download className="h-5 w-5" /> Response Format
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          All responses follow the OData v4 JSON format with <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono">@odata.context</code>, <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono">@odata.count</code>, and <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono">value</code> array.
        </p>
        <div className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto">
{`{
  "@odata.context": "${BASE_URL}/api/v1/powerbi/$metadata#Inspections",
  "@odata.count": 124,
  "value": [
    {
      "InspectionNumber": "RSL-INS-2026-0001",
      "InspectionDate": "2026-07-10T09:15:00Z",
      "OverallResult": "pass",
      "VehicleRegistration": "GT-1234-22",
      "VehicleMake": "Volvo",
      "TransporterName": "Metro Mass Transit Ltd",
      "StationName": "Accra Central Station"
    }
  ]
}`}
        </div>
      </Card>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1">{children}</div>
    </li>
  );
}

function CopyBlock({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className={`mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center gap-2 ${mono ? "font-mono text-xs" : "text-sm"}`}>
      <code className="flex-1 truncate">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}



function DatasetRow({ name, desc, fields, url }: { name: string; desc: string; fields: string; url: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-slate-500" />
          <span className="font-semibold text-slate-900">{name}</span>
        </div>
      </td>
      <td className="py-3 pr-4 text-slate-600">{desc}</td>
      <td className="py-3 pr-4">
        <code className="text-xs text-slate-600 font-mono">{fields}</code>
      </td>
      <td className="py-3 text-right">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          Test →
        </a>
      </td>
    </tr>
  );
}

function QueryExample({ title, url }: { title: string; url: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900 mb-1">{title}</p>
      <CopyBlock value={url} mono />
    </div>
  );
}

function ReportIdea({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <p className="font-semibold text-slate-900 text-sm">{title}</p>
      </div>
      <p className="text-xs text-slate-600">{desc}</p>
    </div>
  );
}
