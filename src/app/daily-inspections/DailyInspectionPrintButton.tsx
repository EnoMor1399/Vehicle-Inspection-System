"use client";

import { Printer } from "lucide-react";

export function DailyInspectionPrintButton() {
  return <button
    type="button"
    onClick={() => window.print()}
    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 print:hidden"
    aria-label="Print daily pre-trip inspection record"
  >
    <Printer className="h-4 w-4" aria-hidden="true" />
    Print checklist
  </button>;
}
