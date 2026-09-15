"use client";

import { Printer } from "lucide-react";

const ASSESSMENT_PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html,
  html.dark,
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    color-scheme: light !important;
  }

  [data-app-shell],
  [data-app-shell] > div,
  .app-shell-content,
  .app-shell-content > div:has(> .assessment-print-root) {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    visibility: visible !important;
    background: #ffffff !important;
  }

  [data-app-shell] > aside,
  [data-app-shell] > div > header,
  .app-shell-content > div:has(> .assessment-print-root) > :not(.assessment-print-root) {
    display: none !important;
  }

  .assessment-print-root {
    --surface-page: #ffffff;
    --surface-card: #ffffff;
    --surface-elevated: #f8fafc;
    --surface-soft: #f8fafc;
    --border-subtle: #cbd5e1;
    --border-strong: #94a3b8;
    --text-primary: #0f172a;
    --text-secondary: #334155;
    --text-muted: #64748b;
    --vims-page: #ffffff;
    --vims-page-deep: #ffffff;
    --vims-panel: #ffffff;
    --vims-panel-solid: #ffffff;
    --vims-panel-soft: #f8fafc;
    --vims-line: #cbd5e1;
    --vims-line-strong: #94a3b8;
    --vims-ink: #0f172a;
    --vims-ink-soft: #334155;
    --vims-ink-muted: #64748b;
    --vims-shadow: none;
    --vims-shadow-soft: none;
    position: static !important;
    inset: auto !important;
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    visibility: visible !important;
    background: #ffffff !important;
    color: #0f172a !important;
    box-shadow: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .assessment-print-root,
  .assessment-print-root * {
    visibility: visible !important;
  }

  .assessment-print-root * {
    color: #0f172a !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    border-color: #cbd5e1 !important;
  }

  .assessment-print-root [class*="overflow-x-auto"],
  .assessment-print-root [class*="overflow-hidden"] {
    overflow: visible !important;
  }

  .assessment-print-root table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
  }

  .assessment-print-root th,
  .assessment-print-root td {
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: normal !important;
  }

  .assessment-print-root thead {
    display: table-header-group;
  }

  .assessment-print-root tr,
  .assessment-print-root .break-inside-avoid-page {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .assessment-print-root .print\\:hidden {
    display: none !important;
  }
}
`;

export default function PrintAssessmentButton() {
  return (
    <>
      <style data-assessment-print-styles>{ASSESSMENT_PRINT_CSS}</style>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3.5 py-2 text-sm font-semibold text-[var(--vims-ink)] transition-colors hover:bg-[var(--vims-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] print:hidden"
      >
        <Printer className="h-4 w-4" />
        Print assessment
      </button>
    </>
  );
}
