"use client";

import { Download, Printer } from "lucide-react";
import { usePathname } from "next/navigation";

export function PrintButton() {
  const pathname = usePathname();
  const inspectionId = pathname.split("/").filter(Boolean).at(-1);
  const pdfHref = inspectionId ? `/api/certificates/${encodeURIComponent(inspectionId)}/pdf` : undefined;

  return (
    <>
      {pdfHref && (
        <a
          href={pdfHref}
          download
          aria-label="Export inspection certificate as PDF"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-sm hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          title="Download certificate as PDF"
        >
          <Download className="h-4 w-4" /> Export PDF
        </a>
      )}
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50"
      >
        <Printer className="h-4 w-4" /> Print
      </button>
    </>
  );
}
