"use client";

import { Printer } from "lucide-react";

export default function PrintAssessmentButton() {
  const openPrintForm = () => {
    const pathname = window.location.pathname.replace(/\/$/, "");
    window.open(`${pathname}/print`, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={openPrintForm}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3.5 py-2 text-sm font-semibold text-[var(--vims-ink)] transition-colors hover:bg-[var(--vims-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] print:hidden"
      title="Open the operational single-page A4 driver assessment form"
    >
      <Printer className="h-4 w-4" />
      Print single-page A4
    </button>
  );
}
