"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50"
    >
      <Printer className="h-4 w-4" /> Print
    </button>
  );
}
