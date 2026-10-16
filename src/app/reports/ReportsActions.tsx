"use client";

import { useState } from "react";
import { CalendarRange, Download, Loader2, Mail, Printer } from "lucide-react";
import * as XLSX from "@e965/xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { neutralizeSpreadsheetFormula } from "@/lib/export-security";
import { reportPeriodLabel } from "@/lib/report-period";
import { getReportExportData } from "./server";

type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "specific_month"
  | "specific_year"
  | "custom"
  | "all_time";

type ExportFormat = "pdf" | "excel" | "csv";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateInputValue(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthRange(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: dateInputValue(year, month, 1),
    endDate: dateInputValue(year, month, lastDay),
  };
}

function selectedPeriod(
  preset: PeriodPreset,
  monthValue: string,
  yearValue: string,
  customStart: string,
  customEnd: string,
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (preset === "all_time") {
    return { startDate: null, endDate: null, error: null };
  }
  if (preset === "this_month") {
    return { ...monthRange(currentYear, currentMonth), error: null };
  }
  if (preset === "last_month") {
    const previous = new Date(currentYear, currentMonth - 2, 1);
    return { ...monthRange(previous.getFullYear(), previous.getMonth() + 1), error: null };
  }
  if (preset === "this_year") {
    return {
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
      error: null,
    };
  }
  if (preset === "last_year") {
    return {
      startDate: `${currentYear - 1}-01-01`,
      endDate: `${currentYear - 1}-12-31`,
      error: null,
    };
  }
  if (preset === "specific_month") {
    if (!/^\d{4}-\d{2}$/.test(monthValue)) {
      return { startDate: null, endDate: null, error: "Choose a month." };
    }
    const [year, month] = monthValue.split("-").map(Number);
    return { ...monthRange(year, month), error: null };
  }
  if (preset === "specific_year") {
    const year = Number(yearValue);
    if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
      return { startDate: null, endDate: null, error: "Choose a valid year." };
    }
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      error: null,
    };
  }

  if (!customStart || !customEnd) {
    return { startDate: customStart || null, endDate: customEnd || null, error: "Choose both custom dates." };
  }
  if (customStart > customEnd) {
    return { startDate: customStart, endDate: customEnd, error: "Start date cannot be after end date." };
  }
  return { startDate: customStart, endDate: customEnd, error: null };
}

function csvCell(value: unknown): string {
  const stringValue = neutralizeSpreadsheetFormula(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\r") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function spreadsheetSafeRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetFormula(value)])
  ));
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportFileStem(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return "rsl-report-all-time";
  return `rsl-report-${startDate}-to-${endDate}`;
}

export function ReportsActions() {
  const now = new Date();
  const [action, setAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [monthValue, setMonthValue] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [yearValue, setYearValue] = useState(String(now.getFullYear()));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = selectedPeriod(preset, monthValue, yearValue, customStart, customEnd);
  const periodLabel = range.error ? "Complete the date selection" : reportPeriodLabel(range.startDate, range.endDate);
  const yearOptions = Array.from({ length: 11 }, (_, index) => now.getFullYear() - index);

  async function loadSelectedReport(kind: string) {
    if (range.error) {
      setStatusMessage(range.error);
      return null;
    }

    setAction(kind);
    setStatusMessage(`Preparing report for ${periodLabel}…`);
    try {
      return await getReportExportData({
        startDate: range.startDate,
        endDate: range.endDate,
      });
    } catch (err) {
      console.error("Report export query failed:", err);
      const message = err instanceof Error ? err.message : "Unable to prepare the selected report.";
      setStatusMessage(message);
      return null;
    }
  }

  async function handleExport(format: ExportFormat) {
    const report = await loadSelectedReport(format);
    if (!report) {
      setAction(null);
      return;
    }

    const label = reportPeriodLabel(report.startDate, report.endDate);
    const stem = reportFileStem(report.startDate, report.endDate);
    const generated = new Date(report.generatedAt).toLocaleString();

    try {
      if (format === "csv") {
        const summaryRows: unknown[][] = [
          ["Road Safety Limited - Inspection Report"],
          ["Period", label],
          ["Generated", generated],
          [],
          ["Metric", "Value"],
          ["Vehicles Inspected", report.stats.vehiclesInspected],
          ["Transporters Represented", report.stats.transportersRepresented],
          ["Total Inspections", report.stats.totalInspections],
          ["Pass Count", report.stats.passCount],
          ["Fail Count", report.stats.failCount],
          ["Conditional / Re-inspection", report.stats.conditionalCount],
          ["Pass Rate", `${report.stats.passRate}%`],
          ["Fail Rate", `${report.stats.failRate}%`],
          ["Inspection Compliance", `${report.stats.complianceRate}%`],
          [],
        ];

        const lines = summaryRows.map((row) => row.map(csvCell).join(","));
        if (report.rows.length > 0) {
          const headers = Object.keys(report.rows[0]);
          lines.push(headers.map(csvCell).join(","));
          lines.push(...report.rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(",")));
        }
        if (report.truncated) {
          lines.push("", csvCell(`Detail rows limited to ${report.rowLimit}; summary metrics include the full selected period.`));
        }

        const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `${stem}.csv`);
      } else if (format === "excel") {
        const wb = XLSX.utils.book_new();
        const summaryData = [
          ["Road Safety Limited - Inspection Report"],
          ["Period", label],
          ["Generated", generated],
          [],
          ["Metric", "Value"],
          ["Vehicles Inspected", report.stats.vehiclesInspected],
          ["Transporters Represented", report.stats.transportersRepresented],
          ["Total Inspections", report.stats.totalInspections],
          ["Pass Count", report.stats.passCount],
          ["Fail Count", report.stats.failCount],
          ["Conditional / Re-inspection", report.stats.conditionalCount],
          ["Pass Rate", `${report.stats.passRate}%`],
          ["Fail Rate", `${report.stats.failRate}%`],
          ["Inspection Compliance", `${report.stats.complianceRate}%`],
          ...(report.truncated ? [["Note", `Detail rows limited to ${report.rowLimit}; summary metrics include the full selected period.`]] : []),
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWs["!cols"] = [{ wch: 30 }, { wch: 44 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

        if (report.rows.length > 0) {
          const inspWs = XLSX.utils.json_to_sheet(spreadsheetSafeRows(report.rows));
          inspWs["!cols"] = Object.keys(report.rows[0] || {}).map((header) => ({
            wch: Math.min(32, Math.max(14, header.length + 4)),
          }));
          XLSX.utils.book_append_sheet(wb, inspWs, "Inspections");
        }

        XLSX.writeFile(wb, `${stem}.xlsx`);
      } else {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(20);
        doc.text("Road Safety Limited", 14, 18);
        doc.setFontSize(14);
        doc.text("Inspection Report", 14, 27);
        doc.setFontSize(10);
        doc.text(`Period: ${label}`, 14, 35);
        doc.text(`Generated: ${generated}`, 14, 41);

        autoTable(doc, {
          startY: 49,
          head: [["Metric", "Value"]],
          body: [
            ["Vehicles Inspected", String(report.stats.vehiclesInspected)],
            ["Transporters Represented", String(report.stats.transportersRepresented)],
            ["Total Inspections", String(report.stats.totalInspections)],
            ["Pass Count", String(report.stats.passCount)],
            ["Fail Count", String(report.stats.failCount)],
            ["Conditional / Re-inspection", String(report.stats.conditionalCount)],
            ["Pass Rate", `${report.stats.passRate}%`],
            ["Fail Rate", `${report.stats.failRate}%`],
            ["Inspection Compliance", `${report.stats.complianceRate}%`],
          ],
          headStyles: { fillColor: [3, 151, 3] },
          styles: { fontSize: 9 },
          tableWidth: 115,
        });

        if (report.rows.length > 0) {
          const headers = Object.keys(report.rows[0]);
          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [headers],
            body: report.rows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? ""))),
            headStyles: { fillColor: [3, 151, 3] },
            styles: { fontSize: 7 },
          });
        }

        if (report.truncated) {
          doc.setFontSize(8);
          doc.text(
            `Detail rows limited to ${report.rowLimit}; summary metrics include the full selected period.`,
            14,
            doc.internal.pageSize.getHeight() - 8,
          );
        }
        doc.save(`${stem}.pdf`);
      }

      setStatusMessage(
        `${format.toUpperCase()} report created for ${label}.${report.truncated ? ` Detail export limited to ${report.rowLimit} rows.` : ""}`
      );
    } catch (err) {
      console.error(`Export ${format} failed:`, err);
      setStatusMessage(`Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setAction(null);
    }
  }

  async function handlePrint() {
    if (range.error) {
      setStatusMessage(range.error);
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setStatusMessage("Allow pop-ups to print the selected report.");
      return;
    }
    printWindow.document.write("<p style='font-family:sans-serif;padding:24px'>Preparing report…</p>");

    const report = await loadSelectedReport("print");
    if (!report) {
      printWindow.close();
      setAction(null);
      return;
    }

    try {
      const label = reportPeriodLabel(report.startDate, report.endDate);
      const headers = report.rows.length > 0 ? Object.keys(report.rows[0]) : [];
      const rows = report.rows.map((row) =>
        `<tr>${headers.map((header) => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`).join("")}</tr>`
      ).join("");

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>RSL Inspection Report - ${escapeHtml(label)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#0f172a;margin:28px} h1{margin:0 0 4px;font-size:24px}
    .meta{color:#475569;margin:0 0 18px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
    .metric{border:1px solid #cbd5e1;border-radius:8px;padding:10px}.metric b{display:block;font-size:20px;margin-top:4px}
    table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
    th{background:#f1f5f9}.note{font-size:10px;color:#64748b;margin-top:10px}
    @media print{body{margin:10mm}.no-print{display:none}}
  </style>
</head>
<body>
  <h1>Road Safety Limited - Inspection Report</h1>
  <p class="meta">Period: ${escapeHtml(label)} · Generated: ${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p>
  <div class="metrics">
    <div class="metric">Inspections<b>${report.stats.totalInspections}</b></div>
    <div class="metric">Pass Rate<b>${report.stats.passRate}%</b></div>
    <div class="metric">Fail Rate<b>${report.stats.failRate}%</b></div>
    <div class="metric">Compliance<b>${report.stats.complianceRate}%</b></div>
  </div>
  ${headers.length ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>` : "<p>No inspections found for this period.</p>"}
  ${report.truncated ? `<p class="note">Detail rows limited to ${report.rowLimit}; summary metrics include the full selected period.</p>` : ""}
</body>
</html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
      setStatusMessage(`Print report prepared for ${label}.`);
    } finally {
      setAction(null);
    }
  }

  async function handleEmail() {
    const report = await loadSelectedReport("email");
    if (!report) {
      setAction(null);
      return;
    }

    try {
      const label = reportPeriodLabel(report.startDate, report.endDate);
      const subject = encodeURIComponent(`RSL Inspection Report - ${label}`);
      const body = encodeURIComponent(
        `Road Safety Limited - Inspection Report\n\n` +
        `Period: ${label}\n` +
        `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n` +
        `Key Metrics:\n` +
        `- Vehicles Inspected: ${report.stats.vehiclesInspected}\n` +
        `- Transporters Represented: ${report.stats.transportersRepresented}\n` +
        `- Total Inspections: ${report.stats.totalInspections}\n` +
        `- Pass Count: ${report.stats.passCount}\n` +
        `- Fail Count: ${report.stats.failCount}\n` +
        `- Conditional / Re-inspection: ${report.stats.conditionalCount}\n` +
        `- Pass Rate: ${report.stats.passRate}%\n` +
        `- Fail Rate: ${report.stats.failRate}%\n` +
        `- Inspection Compliance: ${report.stats.complianceRate}%\n\n` +
        `For detailed records and charts, open Reports & Analytics in VIMS.`
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      setStatusMessage(`Email summary prepared for ${label}.`);
    } finally {
      setAction(null);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print w-full min-w-[290px] sm:min-w-[560px]">
      <div className="mb-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="report-period" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Reporting period
          </label>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
            <CalendarRange className="h-3.5 w-3.5 text-indigo-600" />
            {periodLabel}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)]">
          <select
            id="report-period"
            value={preset}
            onChange={(event) => setPreset(event.target.value as PeriodPreset)}
            disabled={!!action}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="this_year">This year</option>
            <option value="last_year">Last year</option>
            <option value="specific_month">Specific month…</option>
            <option value="specific_year">Specific year…</option>
            <option value="custom">Custom date range…</option>
            <option value="all_time">All time</option>
          </select>

          {preset === "specific_month" && (
            <input
              type="month"
              aria-label="Specific report month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              disabled={!!action}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          )}

          {preset === "specific_year" && (
            <select
              aria-label="Specific report year"
              value={yearValue}
              onChange={(event) => setYearValue(event.target.value)}
              disabled={!!action}
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          )}

          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Report start date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                disabled={!!action}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                type="date"
                aria-label="Report end date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                disabled={!!action}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {!["specific_month", "specific_year", "custom"].includes(preset) && (
            <div className="flex min-h-10 items-center rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 text-xs text-slate-500">
              Select a preset or choose a specific month, year or custom date range.
            </div>
          )}
        </div>
        {range.error && <p className="mt-2 text-[11px] font-medium text-red-600">{range.error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button type="button" onClick={() => handleExport("pdf")} disabled={!!action || !!range.error} aria-busy={action === "pdf"} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
          {action === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
        </button>
        <button type="button" onClick={() => handleExport("excel")} disabled={!!action || !!range.error} aria-busy={action === "excel"} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
          {action === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
        </button>
        <button type="button" onClick={() => handleExport("csv")} disabled={!!action || !!range.error} aria-busy={action === "csv"} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
          {action === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} CSV
        </button>
        <button type="button" onClick={handlePrint} disabled={!!action || !!range.error} aria-busy={action === "print"} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">
          {action === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
        </button>
        <button type="button" onClick={handleEmail} disabled={!!action || !!range.error} aria-busy={action === "email"} className="col-span-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50 sm:col-auto">
          {action === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email Report
        </button>
      </div>

      {statusMessage && (
        <p className="mt-2 max-w-[620px] text-[11px] leading-4 text-slate-500" aria-live="polite">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
