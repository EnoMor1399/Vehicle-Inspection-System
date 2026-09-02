"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Download, FileSpreadsheet, FileText, Table, ChevronDown, Loader2, File } from "lucide-react";
import * as XLSX from "@e965/xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  exportCellText,
  neutralizeSpreadsheetFormula,
  spreadsheetColumnWidth,
} from "@/lib/export-security";

interface ExportMenuProps {
  data: any[];
  filename: string;
  title?: string;
  label?: string;
}

export function ExportMenu({ data, filename, title, label = "Export" }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  function exportToCSV() {
    setExporting("csv");
    try {
      if (data.length === 0) {
        alert("No data to export");
        setExporting(null);
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const stringValue = neutralizeSpreadsheetFormula(row[header]);
              // Escape quotes and wrap in quotes if contains a delimiter or newline.
              if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\r") || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `${filename}.csv`);
    } catch (err) {
      console.error("CSV export failed:", err);
      alert("Failed to export CSV");
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  }

  function exportToExcel() {
    setExporting("excel");
    try {
      if (data.length === 0) {
        alert("No data to export");
        setExporting(null);
        return;
      }

      const headers = Object.keys(data[0]);
      const safeRows = data.map((row) => Object.fromEntries(
        headers.map((header) => [header, neutralizeSpreadsheetFormula(row[header])])
      ));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(safeRows);

      // Bound display widths so unusually long imported text cannot create
      // impractical spreadsheet columns.
      ws["!cols"] = headers.map((key) => ({
        wch: spreadsheetColumnWidth(data.map((row) => row[key]), key),
      }));

      XLSX.utils.book_append_sheet(wb, ws, title || "Data");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Failed to export Excel");
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  }

  function exportToJSON() {
    setExporting("json");
    try {
      if (data.length === 0) {
        alert("No data to export");
        setExporting(null);
        return;
      }

      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      downloadBlob(blob, `${filename}.json`);
    } catch (err) {
      console.error("JSON export failed:", err);
      alert("Failed to export JSON");
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  }

  function exportToPDF() {
    setExporting("pdf");
    try {
      if (data.length === 0) {
        alert("No data to export");
        setExporting(null);
        return;
      }

      const doc = new jsPDF();
      const headers = Object.keys(data[0]);

      // Add title
      doc.setFontSize(18);
      doc.text(title || filename, 14, 20);

      // Add date
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

      // Add table
      autoTable(doc, {
        head: [headers],
        body: data.map((row) => headers.map((header) => exportCellText(row[header]))),
        startY: 35,
        headStyles: { fillColor: [3, 151, 3] },
        styles: { fontSize: 8 },
      });

      doc.save(`${filename}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF");
    } finally {
      setExporting(null);
      setIsOpen(false);
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
    <div className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        {label}
        <ChevronDown className="w-3 h-3" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-slate-200 z-20 overflow-hidden">
            <div className="py-1">
              <button
                onClick={exportToCSV}
                disabled={!!exporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
              >
                {exporting === "csv" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                ) : (
                  <Table className="w-4 h-4 text-slate-600" />
                )}
                <div>
                  <div className="font-medium text-slate-900">CSV Spreadsheet</div>
                  <div className="text-xs text-slate-500">Compatible with Excel, Numbers</div>
                </div>
              </button>

              <button
                onClick={exportToExcel}
                disabled={!!exporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
              >
                {exporting === "excel" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                )}
                <div>
                  <div className="font-medium text-slate-900">Excel Workbook</div>
                  <div className="text-xs text-slate-500">.xlsx format with formatting</div>
                </div>
              </button>

              <button
                onClick={exportToPDF}
                disabled={!!exporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                ) : (
                  <File className="w-4 h-4 text-red-600" />
                )}
                <div>
                  <div className="font-medium text-slate-900">PDF Report</div>
                  <div className="text-xs text-slate-500">Formatted document</div>
                </div>
              </button>

              <button
                onClick={exportToJSON}
                disabled={!!exporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
              >
                {exporting === "json" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600" />
                )}
                <div>
                  <div className="font-medium text-slate-900">JSON Data</div>
                  <div className="text-xs text-slate-500">For API integrations</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
