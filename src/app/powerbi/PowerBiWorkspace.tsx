"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, Select, TextInput } from "@/components/ui";
import { CopyButton } from "./CopyButton";

type Dataset = {
  name: string;
  description: string;
  fields: string[];
  restricted?: boolean;
};

const DATASETS: Dataset[] = [
  {
    name: "Inspections",
    description: "Technical inspection outcomes, station, inspector, vehicle and transporter details.",
    fields: ["InspectionNumber", "InspectionDate", "OverallResult", "WorkflowStatus", "VehicleRegistration", "InspectorName", "TransporterName"],
  },
  {
    name: "PreTripInspections",
    description: "Daily Pre-Trip / Safe-To-Load checks, trip clearance, driver and checklist totals.",
    fields: ["InspectionDate", "Status", "ClearedForTrip", "VehicleRegistration", "DriverName", "PassedItems", "FailedItems", "TransporterName"],
  },
  {
    name: "Vehicles",
    description: "Fleet register with status, vehicle profile, expiry dates and inspection counts.",
    fields: ["RegistrationNumber", "Make", "Model", "Status", "Category", "TransporterName", "TotalInspections"],
  },
  {
    name: "Transporters",
    description: "Transporter companies, region, fleet size and inspection compliance counts.",
    fields: ["CompanyName", "Region", "District", "FleetSize", "PassCount", "FailCount"],
  },
  {
    name: "Stations",
    description: "Inspection stations with capacity, volume, inspector count and outcomes.",
    fields: ["Name", "Code", "Region", "Capacity", "InspectionCount", "PassCount", "FailCount"],
  },
  {
    name: "Defects",
    description: "Failed checklist items with severity, remarks, vehicle and evidence counts.",
    fields: ["InspectionNumber", "InspectionDate", "VehicleRegistration", "SectionCode", "ItemName", "Severity", "PhotoCount"],
  },
  {
    name: "Documents",
    description: "Document register with owner, version, expiry and uploader information.",
    fields: ["Name", "Type", "OwnerType", "ExpiryDate", "Version", "UploadedBy"],
    restricted: true,
  },
  {
    name: "AuditLogs",
    description: "Security and compliance audit trail for privileged operational events.",
    fields: ["Action", "EntityType", "UserName", "Summary", "IPAddress", "CreatedAt"],
    restricted: true,
  },
  {
    name: "Users",
    description: "User accounts, roles, station assignment and activity metadata.",
    fields: ["Name", "Email", "Role", "IsActive", "LastLoginAt", "StationName"],
    restricted: true,
  },
];

type ConnectionState = "idle" | "testing" | "connected" | "error";

type PreviewState = {
  loading: boolean;
  error: string | null;
  rows: Record<string, unknown>[];
  total?: number;
  elapsedMs?: number;
};

const EMPTY_PREVIEW: PreviewState = { loading: false, error: null, rows: [] };

export function PowerBiWorkspace({ baseUrl }: { baseUrl: string }) {
  const serviceUrl = `${baseUrl}/api/v1/powerbi`;
  const metadataUrl = `${serviceUrl}/$metadata`;

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Not tested");
  const [availableDatasets, setAvailableDatasets] = useState<string[] | null>(null);
  const [connectionMs, setConnectionMs] = useState<number | null>(null);

  const [datasetSearch, setDatasetSearch] = useState("");
  const [dataset, setDataset] = useState("Inspections");
  const [filter, setFilter] = useState("");
  const [selectFields, setSelectFields] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [top, setTop] = useState("25");
  const [includeCount, setIncludeCount] = useState(true);
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);

  const filteredDatasets = useMemo(() => {
    const q = datasetSearch.trim().toLowerCase();
    if (!q) return DATASETS;
    return DATASETS.filter((item) =>
      `${item.name} ${item.description} ${item.fields.join(" ")}`.toLowerCase().includes(q),
    );
  }, [datasetSearch]);

  const selectedDataset = DATASETS.find((item) => item.name === dataset) || DATASETS[0];

  const queryUrl = useMemo(() => {
    const url = new URL(serviceUrl);
    url.searchParams.set("path", dataset);
    if (filter.trim()) url.searchParams.set("$filter", filter.trim());
    if (selectFields.trim()) url.searchParams.set("$select", selectFields.trim());
    if (orderBy.trim()) url.searchParams.set("$orderby", orderBy.trim());
    url.searchParams.set("$top", String(Math.min(500, Math.max(1, Number(top) || 25))));
    if (includeCount) url.searchParams.set("$count", "true");
    return url.toString();
  }, [dataset, filter, includeCount, orderBy, selectFields, serviceUrl, top]);

  const powerQuery = useMemo(() => {
    const escapedUrl = queryUrl.replace(/"/g, '""');
    return `let\n    ApiKey = "PASTE_API_KEY_HERE",\n    Response = Json.Document(\n        Web.Contents(\n            "${escapedUrl}",\n            [Headers=[#"X-API-Key"=ApiKey, Accept="application/json"]]\n        )\n    ),\n    Rows = try Response[value] otherwise {},\n    Data = if List.Count(Rows) = 0 then #table({}, {}) else Table.FromRecords(Rows)\nin\n    Data`;
  }, [queryUrl]);

  async function testConnection() {
    if (!apiKey.trim()) {
      setConnectionState("error");
      setConnectionMessage("Enter an API key before testing the connector.");
      return;
    }

    setConnectionState("testing");
    setConnectionMessage("Testing secure OData access…");
    const started = performance.now();

    try {
      const response = await fetch(serviceUrl, {
        headers: { "X-API-Key": apiKey.trim(), Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || `Connection failed (${response.status})`);
      }

      const sets = Array.isArray(body?.value)
        ? body.value.map((item: { name?: string }) => item?.name).filter(Boolean)
        : [];
      const elapsed = Math.round(performance.now() - started);
      setAvailableDatasets(sets);
      setConnectionMs(elapsed);
      setConnectionState("connected");
      setConnectionMessage(`${sets.length} datasets available to this credential.`);
    } catch (error) {
      setAvailableDatasets(null);
      setConnectionMs(null);
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "Unable to connect to the Power BI endpoint.");
    }
  }

  async function runPreview() {
    if (!apiKey.trim()) {
      setPreview({ loading: false, error: "Enter an API key in Connection Test before running a preview.", rows: [] });
      return;
    }

    setPreview({ loading: true, error: null, rows: [] });
    const started = performance.now();
    try {
      const response = await fetch(queryUrl, {
        headers: { "X-API-Key": apiKey.trim(), Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || body?.message || `Query failed (${response.status})`);
      }
      setPreview({
        loading: false,
        error: null,
        rows: Array.isArray(body?.value) ? body.value.slice(0, 10) : [],
        total: typeof body?.["@odata.count"] === "number" ? body["@odata.count"] : undefined,
        elapsedMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      setPreview({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to preview this query.",
        rows: [],
      });
    }
  }

  function downloadPowerQuery() {
    const blob = new Blob([powerQuery], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `vims-${dataset.toLowerCase()}-power-query.pq`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  function resetQuery() {
    setDataset("Inspections");
    setFilter("");
    setSelectFields("");
    setOrderBy("");
    setTop("25");
    setIncludeCount(true);
    setPreview(EMPTY_PREVIEW);
  }

  const previewColumns = preview.rows.length > 0 ? Object.keys(preview.rows[0]).slice(0, 8) : [];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<Database className="h-5 w-5" />} label="Datasets" value="9" hint="Core VIMS entities" />
        <SummaryCard icon={<Activity className="h-5 w-5" />} label="Query Limit" value="500" hint="Rows per request" />
        <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="Protocol" value="OData v4" hint="Power BI compatible" />
        <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Security" value="API key" hint="Report permission required" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connection test</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Validate Power BI access</h2>
              <p className="mt-1 text-sm text-slate-500">The API key stays in this browser session and is not stored by this page.</p>
            </div>
            <StatusBadge state={connectionState} />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Service URL</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-700">{serviceUrl}</code>
                <CopyButton value={serviceUrl} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">API key</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Paste a report-enabled API key"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-950 outline-none focus:border-[var(--brand-color)] focus:ring-4 focus:ring-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button onClick={testConnection} disabled={connectionState === "testing"} className="w-full sm:w-auto">
              <RefreshCw className={`h-4 w-4 ${connectionState === "testing" ? "animate-spin" : ""}`} />
              {connectionState === "testing" ? "Testing…" : "Test connection"}
            </Button>

            <div className={`rounded-xl px-4 py-3 text-sm ${connectionState === "connected" ? "bg-emerald-50 text-emerald-800" : connectionState === "error" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
              <div className="flex items-center justify-between gap-3">
                <span>{connectionMessage}</span>
                {connectionMs !== null && <span className="shrink-0 text-xs font-semibold">{connectionMs} ms</span>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick setup</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Connect from Power BI Desktop</h2>
            </div>
            <Badge tone="blue">OData v4</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <QuickStep number="1" title="Get Data" text="Choose OData Feed or use the generated Power Query script." />
            <QuickStep number="2" title="Authenticate" text="Use the service URL and X-API-Key header." />
            <QuickStep number="3" title="Model" text="Select datasets, create relationships, measures and dashboards." />
          </div>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Schema metadata</p>
                <p className="mt-0.5 text-xs text-slate-500">Use this endpoint for OData entity and field discovery.</p>
              </div>
              <CopyButton value={metadataUrl} />
            </div>
            <code className="mt-2 block break-all text-xs text-slate-600">{metadataUrl}</code>
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Dataset explorer</h2>
              <p className="mt-1 text-sm text-slate-500">Find a dataset, review its useful fields, then send it to the query builder.</p>
            </div>
            <label className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={datasetSearch}
                onChange={(event) => setDatasetSearch(event.target.value)}
                placeholder="Search datasets or fields"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--brand-color)] focus:ring-4 focus:ring-slate-100"
              />
            </label>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
          {filteredDatasets.map((item) => {
            const knownAvailable = availableDatasets === null || availableDatasets.includes(item.name);
            const active = dataset === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setDataset(item.name);
                  setPreview(EMPTY_PREVIEW);
                }}
                className={`rounded-2xl border p-4 text-left transition ${active ? "border-slate-900 bg-slate-950 text-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-xl ${active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Database className="h-4 w-4" />
                  </div>
                  {!knownAvailable ? <Badge tone="red">Unavailable</Badge> : item.restricted ? <Badge tone="amber">Permission based</Badge> : null}
                </div>
                <p className={`mt-3 font-semibold ${active ? "text-white" : "text-slate-950"}`}>{item.name}</p>
                <p className={`mt-1 text-xs leading-5 ${active ? "text-slate-300" : "text-slate-500"}`}>{item.description}</p>
                <p className={`mt-3 line-clamp-2 text-[11px] font-mono ${active ? "text-slate-400" : "text-slate-500"}`}>{item.fields.join(" · ")}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Query builder</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Build an OData request</h2>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dataset</label>
              <Select value={dataset} onChange={(event) => setDataset(event.target.value)}>
                {DATASETS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4" /> Filter</label>
              <TextInput value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="OverallResult eq 'fail'" />
              <p className="mt-1.5 text-xs text-slate-500">Supported comparisons: eq, ne, gt, lt, ge, le joined with AND / OR.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Select fields</label>
              <TextInput value={selectFields} onChange={(event) => setSelectFields(event.target.value)} placeholder={selectedDataset.fields.slice(0, 4).join(",")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Order by</label>
                <TextInput value={orderBy} onChange={(event) => setOrderBy(event.target.value)} placeholder="InspectionDate desc" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rows</label>
                <TextInput type="number" min={1} max={500} value={top} onChange={(event) => setTop(event.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={includeCount} onChange={(event) => setIncludeCount(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Include total row count
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-slate-100">
              <div className="flex items-start gap-3">
                <code className="min-w-0 flex-1 break-all text-xs leading-5">{queryUrl}</code>
                <CopyButton value={queryUrl} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={runPreview} disabled={preview.loading}>
                <Play className="h-4 w-4" /> {preview.loading ? "Running…" : "Run preview"}
              </Button>
              <Button variant="secondary" onClick={downloadPowerQuery}>
                <Download className="h-4 w-4" /> Download Power Query
              </Button>
              <Button variant="ghost" onClick={resetQuery}>Reset</Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live preview</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Query results</h2>
            </div>
            {preview.elapsedMs !== undefined && <Badge tone="slate">{preview.elapsedMs} ms</Badge>}
          </div>

          {preview.error ? (
            <div className="m-5 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:m-6">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {preview.error}
            </div>
          ) : preview.loading ? (
            <div className="grid min-h-64 place-items-center text-sm text-slate-500">
              <div className="text-center"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />Running secure query…</div>
            </div>
          ) : preview.rows.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-6 text-center">
              <div>
                <Table2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-900">No preview loaded</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Test your API key, choose a dataset, then run a preview. Up to 10 rows are displayed here.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
                <span>{preview.rows.length} rows shown</span>
                {preview.total !== undefined && <><span>·</span><span>{preview.total} total rows</span></>}
              </div>
              <div className="max-h-[430px] overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>{previewColumns.map((column) => <th key={column} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-semibold">{column}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        {previewColumns.map((column) => (
                          <td key={column} className="max-w-56 truncate px-4 py-3 text-slate-700" title={formatCell(row[column])}>{formatCell(row[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Power Query starter</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Generated M script</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">The downloaded script contains a placeholder API key, never the key entered on this page.</p>
          </div>
          <div className="flex gap-2">
            <CopyButton value={powerQuery} />
            <Button variant="secondary" size="sm" onClick={downloadPowerQuery}><Download className="h-4 w-4" /> Download .pq</Button>
          </div>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100"><code>{powerQuery}</code></pre>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">{icon}</div>
      </div>
    </Card>
  );
}

function QuickStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white">{number}</span>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function StatusBadge({ state }: { state: ConnectionState }) {
  if (state === "connected") return <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Connected</Badge>;
  if (state === "error") return <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> Check required</Badge>;
  if (state === "testing") return <Badge tone="blue"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing</Badge>;
  return <Badge tone="slate">Not tested</Badge>;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
