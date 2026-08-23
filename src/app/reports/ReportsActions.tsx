"use client";

import { useState } from "react";
import { Download, Printer, Mail, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportsActionsProps {
  recentData: any[];
  stats: any;
}

export function ReportsActions({ recentData, stats }: ReportsActionsProps) {
  const [action, setAction] = useState<string | null>(null);

  function handleExport(format: "pdf" | "excel" | "csv") {
    setAction(format);
    const exportTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    try {
      if (format === "csv") {
        const headers = Object.keys(recentData[0] || {});
        const csvContent = [
          headers.join(","),
          ...recentData.map((row: any) =>
            headers.map((header) => {
              const value = row[header];
              const stringValue = value === null || value === undefined ? "" : String(value);
              if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            }).join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `rsl-report-${exportTimestamp}.csv`);
      } else if (format === "excel") {
        const wb = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = [
          ["Road Safety Limited - Executive Report"],
          [`Generated: ${new Date().toLocaleString()}`],
          [],
          ["Metric", "Value"],
          ["Total Vehicles", stats.totalVehicles],
          ["Total Transporters", stats.totalTransporters],
          ["Total Inspections", stats.totalInspections],
          ["Pass Rate", `${stats.passRate}%`],
          ["Fail Rate", `${stats.failRate}%`],
          ["Fleet Compliance", `${stats.complianceRate}%`],
        ];
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        summaryWs["!cols"] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

        // Inspections sheet
        if (recentData.length > 0) {
          const inspWs = XLSX.utils.json_to_sheet(recentData);
          XLSX.utils.book_append_sheet(wb, inspWs, "Recent Inspections");
        }

        XLSX.writeFile(wb, `rsl-report-${exportTimestamp}.xlsx`);
      } else if (format === "pdf") {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.text("Road Safety Limited", 14, 20);
        doc.setFontSize(14);
        doc.text("Executive Report", 14, 28);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

        // Summary stats
        doc.setFontSize(12);
        doc.text("Key Metrics", 14, 50);

        autoTable(doc, {
          startY: 55,
          head: [["Metric", "Value"]],
          body: [
            ["Total Vehicles", stats.totalVehicles.toString()],
            ["Total Transporters", stats.totalTransporters.toString()],
            ["Total Inspections", stats.totalInspections.toString()],
            ["Pass Rate", `${stats.passRate}%`],
            ["Fail Rate", `${stats.failRate}%`],
            ["Fleet Compliance", `${stats.complianceRate}%`],
          ],
          headStyles: { fillColor: [3, 151, 3] },
          styles: { fontSize: 10 },
        });

        // Recent inspections
        if (recentData.length > 0) {
          doc.setFontSize(12);
          doc.text("Recent Inspections", 14, (doc as any).lastAutoTable.finalY + 15);

          const headers = Object.keys(recentData[0]);
          autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [headers],
            body: recentData.map((row: any) => headers.map((h) => row[h] || "")),
            headStyles: { fillColor: [3, 151, 3] },
            styles: { fontSize: 8 },
          });
        }

        doc.save(`rsl-report-${exportTimestamp}.pdf`);
      }
    } catch (err) {
      console.error(`Export ${format} failed:`, err);
      alert(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setAction(null);
    }
  }

  function handlePrint() {
    setAction("print");
    window.print();
    setTimeout(() => setAction(null), 1000);
  }

  function handleEmail() {
    setAction("email");
    const subject = encodeURIComponent("RSL Executive Report");
    const body = encodeURIComponent(
      `Road Safety Limited - Executive Report Summary\n\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      `Key Metrics:\n` +
      `- Total Vehicles: ${stats.totalVehicles}\n` +
      `- Total Transporters: ${stats.totalTransporters}\n` +
      `- Total Inspections: ${stats.totalInspections}\n` +
      `- Pass Rate: ${stats.passRate}%\n` +
      `- Fail Rate: ${stats.failRate}%\n` +
      `- Fleet Compliance: ${stats.complianceRate}%\n\n` +
      `For the full report with charts and detailed analysis, please visit the Reports & Analytics page.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setTimeout(() => setAction(null), 1000);
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
    <div className="flex items-center gap-2 no-print">
      <button
        onClick={() => handleExport("pdf")}
        disabled={!!action}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {action === "pdf" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        PDF
      </button>
      <button
        onClick={() => handleExport("excel")}
        disabled={!!action}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {action === "excel" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Excel
      </button>
      <button
        onClick={() => handleExport("csv")}
        disabled={!!action}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {action === "csv" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        CSV
      </button>
      <button
        onClick={handlePrint}
        disabled={!!action}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
      >
        {action === "print" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        Print
      </button>
      <button
        onClick={handleEmail}
        disabled={!!action}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {action === "email" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Email Report
      </button>
    </div>
  );
}
