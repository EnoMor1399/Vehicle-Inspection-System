"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  Play,
  RefreshCw,
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
    description: "Technical inspection results, vehicles, inspectors, stations and transporters.",
    fields: ["InspectionNumber", "InspectionDate", "OverallResult", "WorkflowStatus", "VehicleRegistration", "InspectorName", "TransporterName"],
  },
  {
    name: "PreTripInspections",
    description: "Pre-Trip / Safe-To-Load checks, trip clearance, drivers and checklist totals.",
    fields: ["InspectionDate", "Status", "ClearedForTrip", "VehicleRegistration", "DriverName", "PassedItems", "FailedItems", "TransporterName"],
  },
  {
    name: "Vehicles",
    description: "Fleet register, vehicle status, expiry dates and inspection counts.",
    fields: ["RegistrationNumber", "Make", "Model", "Status", "Category", "TransporterName", "TotalInspections"],
  },
  {
    name: "Transporters",
    description: "Transporter companies, regions, fleet size and inspection compliance.",
    fields: ["CompanyName", "Region", "District", "FleetSize", "PassCount", "FailCount"],
  },
  {
    name: "Stations",
    description: "Inspection stations, capacity, volume, inspectors and outcomes.",
    fields: ["Name", "Code", "Region", "Capacity", "InspectionCount", "PassCount", "FailCount"],
  },
  {
    name: "Defects",
    description: "Failed checklist items, severity, remarks, vehicles and evidence counts.",
    fields: ["InspectionNumber", "InspectionDate", "VehicleRegistration", "SectionCode", "ItemName", "Severity", "PhotoCount"],
  },
  {
    name: "Documents",
    description: "Document register, ownership, versions and expiry information.",
    fields: ["Name", "Type", "OwnerType", "ExpiryDate", "Version", "UploadedBy"],
    restricted: true,
  },
  {
    name: "AuditLogs",
    description: "Security and compliance audit trail for privileged events.",
    fields: ["Action", "EntityType", "UserName", "Summary", "IPAddress", "CreatedAt"],
    restricted: true,
  },
  {
    name: "Users",
    description: "User accounts, roles, station assignments and activity metadata.",
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

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [connectionMessage, setConnectionMessage] = useState("Not tested");
  const [availableDatasets, setAvailableDatasets] = useState<string[] | null>(null);
  const [connectionMs, setConnectionMs] = useState<number | null>(null);

  const [dataset, setDataset] = useState("Inspections");
  const [filter, setFilter] = useState("");
  const [selectFields, setSelectFields] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [top, setTop] = useState("25");
  const [includeCount, setIncludeCount] = useState(true);
  const [preview, setPreview] = useState<PreviewState>(EMPTY_PREVIEW);

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
      setConnectionMessage("Enter an API key first.");
      return;
    }

    setConnectionState("testing");
    setConnectionMessage("Testing connection…");
    const started = performance.now();

    try {
      const response = await fetch(serviceUrl, {
        headers: { "X-API-Key": apiKey.trim(), Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || body?.error || body?.message || `Connection failed (${response.status})`);
      }

      const sets = Array.isArray(body?.value)
        ? body.value.map((item: { name?: string }) => item?.name).filter(Boolean)
        : [];
      setAvailableDatasets(sets);
      setConnectionMs(Math.round(performance.now() - started));
      setConnectionState("connected");
      setConnectionMessage(`Connected · ${sets.length} datasets available`);
    } catch (error) {
      setAvailableDatasets(null);
      setConnectionMs(null);
      setConnectionState("error");
      setConnectionMessage(error instanceof Error ? error.message : "Unable to connect.");
    }
  }

  async function runPreview() {
    if (!apiKey.trim()) {
      setPreview({ loading: false, error: "Enter and test an API key before previewing data.", rows: [] });
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
        throw new Error(body?.error?.message || body?.error || body?.message || `Query failed (${response.status})`);
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
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700">API key</label>
              <StatusBadge state={connectionState} />
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste your VIMS API key"
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

          <Button onClick={testConnection} disabled={connectionState === "testing"} className="lg:mb-0.5">
            <RefreshCw className={`h-4 w-4 ${connectionState === "testing" ? "animate-spin" : ""}`} />
            {connectionState === "testing" ? "Testing…" : "Test connection"}
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className={connectionState === "connected" ? "text-emerald-700" : connectionState === "error" ? "text-red-600" : "text-slate-500"}>
            {connectionMessage}{connectionMs !== null ? ` · ${connectionMs} ms` : ""}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-slate-500">
            <code className="truncate">{serviceUrl}</code>
            <CopyButton value={serviceUrl} />
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Data source</h2>
          <p className="mt-1 text-sm text-slate-500">Choose what you want to send to Power BI.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dataset</label>
              <Select
                value={dataset}
                onChange={(event) => {
                  setDataset(event.target.value);
                  setPreview(EMPTY_PREVIEW);
                }}
              >
                {DATASETS.map((item) => {
                  const unavailable = availableDatasets !== null && !availableDatasets.includes(item.name);
                  return (
                    <option key={item.name} value={item.name} disabled={unavailable}>
                      {item.name}{item.restricted ? " · restricted" : ""}{unavailable ? " · unavailable" : ""}
                    </option>
                  );
                })}
              </Select>
              <p className="mt-2 text-xs leading-5 text-slate-500">{selectedDataset.description}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Rows</label>
              <TextInput type="number" min={1} max={500} value={top} onChange={(event) => setTop(event.target.value)} />
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50/70">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700">
                <Filter className="h-4 w-4" /> Advanced query options
              </summary>
              <div className="space-y-4 border-t border-slate-200 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Filter</label>
                  <TextInput value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="OverallResult eq 'fail'" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Select fields</label>
                  <TextInput value={selectFields} onChange={(event) => setSelectFields(event.target.value)} placeholder={selectedDataset.fields.slice(0, 4).join(",")} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Order by</label>
                  <TextInput value={orderBy} onChange={(event) => setOrderBy(event.target.value)} placeholder="InspectionDate desc" />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={includeCount} onChange={(event) => setIncludeCount(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Include total row count
                </label>
                <div className="flex items-start gap-2 rounded-lg bg-slate-950 p-3 text-slate-100">
                  <code className="min-w-0 flex-1 break-all text-[11px] leading-5">{queryUrl}</code>
                  <CopyButton value={queryUrl} />
                </div>
              </div>
            </details>

            <div className="grid gap-2">
              <Button onClick={runPreview} disabled={preview.loading}>
                <Play className="h-4 w-4" /> {preview.loading ? "Running…" : "Preview data"}
              </Button>
              <Button variant="secondary" onClick={downloadPowerQuery}>
                <Download className="h-4 w-4" /> Download for Power BI
              </Button>
              <Button variant="ghost" onClick={resetQuery}>Reset</Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-950">Preview</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {preview.total !== undefined && <span>{preview.total} total</span>}
              {preview.elapsedMs !== undefined && <Badge tone="slate">{preview.elapsedMs} ms</Badge>}
            </div>
          </div>

          {preview.error ? (
            <div className="m-5 flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:m-6">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {preview.error}
            </div>
          ) : preview.loading ? (
            <div className="grid min-h-72 place-items-center text-sm text-slate-500">
              <div className="text-center"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading data…</div>
            </div>
          ) : preview.rows.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 text-center">
              <div>
                <Table2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-900">No data preview yet</p>
                <p className="mt-1 text-xs text-slate-500">Choose a dataset and click Preview data.</p>
              </div>
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
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
          )}
        </Card>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 sm:px-6">
          Power Query script
          <span className="ml-2 font-normal text-slate-500">for advanced setup</span>
        </summary>
        <div className="border-t border-slate-200 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">The script contains a placeholder, not the API key entered above.</p>
            <div className="flex gap-2">
              <CopyButton value={powerQuery} />
              <Button variant="secondary" size="sm" onClick={downloadPowerQuery}><Download className="h-4 w-4" /> Download .pq</Button>
            </div>
          </div>
          <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100"><code>{powerQuery}</code></pre>
        </div>
      </details>
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
