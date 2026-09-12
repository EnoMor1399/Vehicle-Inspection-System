"use client";

import { Printer } from "lucide-react";

export default function PrintAssessmentButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3.5 py-2 text-sm font-semibold text-[var(--vims-ink)] transition-colors hover:bg-[var(--vims-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] print:hidden"
    >
      <Printer className="h-4 w-4" />
      Print assessment
    </button>
  );
}
