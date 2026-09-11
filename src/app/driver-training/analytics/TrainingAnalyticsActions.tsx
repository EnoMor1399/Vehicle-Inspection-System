"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "@e965/xlsx";
import { neutralizeSpreadsheetFormula, spreadsheetColumnWidth } from "@/lib/export-security";

function safeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetFormula(value)])
  ));
}

function csvCell(value: unknown) {
  const text = neutralizeSpreadsheetFormula(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function TrainingAnalyticsActions({ rows }: { rows: Record<string, unknown>[] }) {
  const [working, setWorking] = useState<"csv" | "excel" | null>(null);

  function exportCsv() {
    setWorking("csv");
    try {
      const headers = Object.keys(rows[0] || { Service: "", Sessions: "", Participants: "", Passed: "", Failed: "", "Pass Rate": "" });
      const body = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
      downloadBlob(new Blob([body], { type: "text/csv;charset=utf-8" }), `driver-training-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setWorking(null);
    }
  }

  function exportExcel() {
    setWorking("excel");
    try {
      const safe = safeRows(rows);
      const worksheet = XLSX.utils.json_to_sheet(safe);
      const headers = Object.keys(safe[0] || {});
      worksheet["!cols"] = headers.map((header) => ({
        wch: spreadsheetColumnWidth(safe.map((row) => row[header]), header),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Training Analytics");
      XLSX.writeFile(workbook, `driver-training-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={exportCsv} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3 py-2 text-sm font-semibold text-[var(--vims-ink)] shadow-sm hover:bg-[var(--vims-panel-soft)] disabled:opacity-50">
        {working === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
      </button>
      <button type="button" onClick={exportExcel} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--vims-ink)] px-3 py-2 text-sm font-semibold text-[var(--vims-panel-solid)] shadow-sm hover:opacity-90 disabled:opacity-50">
        {working === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
      </button>
    </div>
  );
}
