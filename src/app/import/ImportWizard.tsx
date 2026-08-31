"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "@e965/xlsx";
import { Button, Card, Field, Select, Badge } from "@/components/ui";
import { Upload, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { submitImport } from "./server";

type Step = "upload" | "mapping" | "preview" | "complete";

export function ImportWizard({ entityTypes }: { entityTypes: { value: string; label: string; fields: string[]; required: string[] }[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState(entityTypes[0].value);
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [result, setResult] = useState<{ imported: number; invalid: number; jobId: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = entityTypes.find((e) => e.value === entityType)!;
  const maxRows = entityType === "pre_trip_inspections" ? 5000 : 500;

  function handleFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        });
        const normalized = rows.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v).trim()]))
        );

        if (normalized.length === 0) {
          alert("No data rows were found in the first worksheet.");
          setFile(null);
          return;
        }
        if (normalized.length > maxRows) {
          alert(`${selected.label} imports support up to ${maxRows.toLocaleString()} rows per file. This file contains ${normalized.length.toLocaleString()} rows.`);
          setFile(null);
          return;
        }

        setRawData(normalized);
        // Auto-map columns by name similarity.
        const headers = Object.keys(normalized[0] || {});
        const autoMap: Record<string, string> = {};
        selected.fields.forEach((field) => {
          const match = headers.find((header) => header.toLowerCase().replace(/[^a-z0-9]/g, "") === field.toLowerCase().replace(/[^a-z0-9]/g, ""));
          if (match) autoMap[field] = match;
        });
        setMapping(autoMap);
        setErrors([]);
        setStep("mapping");
      } catch (err) {
        alert("Failed to read file: " + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  const headers = useMemo(() => (rawData.length > 0 ? Object.keys(rawData[0]) : []), [rawData]);

  function validate() {
    const errs: { row: number; field: string; message: string }[] = [];
    rawData.forEach((row, idx) => {
      selected.required.forEach((field) => {
        const col = mapping[field];
        if (!col) {
          if (!errs.find((e) => e.row === 0 && e.field === field)) errs.push({ row: 0, field, message: `Required column "${field}" is not mapped` });
        } else if (!row[col]) {
          errs.push({ row: idx + 1, field, message: "Missing required value" });
        }
      });
    });
    setErrors(errs.slice(0, 50));
    setStep("preview");
  }

  function runImport() {
    startTransition(async () => {
      try {
        const res = await submitImport({
          fileName: file!.name,
          fileType: file!.name.split(".").pop() || "csv",
          entityType,
          rows: rawData,
          mapping,
        });
        setResult(res);
        setStep("complete");
      } catch (e: any) {
        alert(e.message || "Import failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {["upload", "mapping", "preview", "complete"].map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-semibold ${
              step === s ? "bg-slate-900 text-white" :
              ["upload", "mapping", "preview", "complete"].indexOf(step) > idx ? "bg-emerald-500 text-white" :
              "bg-slate-200 text-slate-500"
            }`}>
              {idx + 1}
            </div>
            <span className="capitalize">{s}</span>
            {idx < 3 && <ArrowRight className="h-4 w-4 text-slate-400 mx-2" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <Card className="p-8">
          <Field label="Entity Type">
            <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setFile(null); setRawData([]); setMapping({}); setErrors([]); }}>
              {entityTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInput.current?.click()}
            className="mt-6 border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-[var(--brand-color)] hover:bg-emerald-50/40 cursor-pointer transition"
          >
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
            <p className="font-medium text-slate-900">Drop XLSX, XLS or CSV here</p>
            <p className="text-sm text-slate-500 mt-1">or click to browse — up to 10MB · max {maxRows.toLocaleString()} rows</p>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Historical data can be imported to preserve operational history and analytics. Pre-Trip / Safe-To-Load imports may contain up to 5,000 rows; checklist item answers are not invented when the historical source only records trip clearance.
          </p>
        </Card>
      )}

      {step === "mapping" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Column Mapping</h2>
              <p className="text-sm text-slate-500">{file?.name} — {rawData.length.toLocaleString()} rows detected</p>
            </div>
            <Badge tone="blue">{headers.length} columns</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selected.fields.map((field) => (
              <div key={field} className="flex items-center gap-2 text-sm">
                <span className="w-40 font-medium">{field}{selected.required.includes(field) ? <span className="text-red-500"> *</span> : null}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={mapping[field] || ""}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— skip —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
            <Button onClick={validate}>Validate & Preview</Button>
          </div>
        </Card>
      )}

      {step === "preview" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Preview & Validation</h2>
              <p className="text-sm text-slate-500">
                {rawData.length.toLocaleString()} rows · {errors.length === 0 ? "No required-field validation errors" : `${errors.length} issues detected`}
              </p>
            </div>
            {errors.length > 0 ? <Badge tone="red">{errors.length} errors</Badge> : <Badge tone="emerald">Ready</Badge>}
          </div>

          {errors.length > 0 && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-red-900 mb-2 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Validation issues</p>
              <ul className="text-xs text-red-700 space-y-0.5">
                {errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e.row === 0 ? "Schema" : `Row ${e.row}`} · {e.field}: {e.message}</li>
                ))}
                {errors.length > 20 && <li className="text-red-500">… and {errors.length - 20} more</li>}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {selected.fields.map((field) => <th key={field} className="px-2 py-1 text-left font-medium">{field}</th>)}
                </tr>
              </thead>
              <tbody>
                {rawData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {selected.fields.map((field) => <td key={field} className="px-2 py-1">{row[mapping[field] || ""] || "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("mapping")}>Back</Button>
            <Button onClick={runImport} disabled={pending || errors.length > 0}>
              {pending ? "Importing..." : `Import ${rawData.length.toLocaleString()} records`}
            </Button>
          </div>
        </Card>
      )}

      {step === "complete" && result && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-slate-950">Import Complete</h2>
          <p className="text-slate-600 mt-2">
            <span className="font-semibold text-emerald-600">{result.imported.toLocaleString()}</span> records imported ·{" "}
            <span className="font-semibold text-red-600">{result.invalid.toLocaleString()}</span> invalid
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono">Job ID: {result.jobId}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={() => { setStep("upload"); setRawData([]); setFile(null); setResult(null); setMapping({}); setErrors([]); }}>
              New Import
            </Button>
            <Button onClick={() => router.push("/")}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
