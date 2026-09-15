"use client";

import { Printer } from "lucide-react";

const ASSESSMENT_PRINT_CSS = `
@media print {
  @page {
    size: A4 portrait;
    margin: 7mm;
  }

  html,
  html.dark,
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    color-scheme: light !important;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
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
    width: 196mm !important;
    max-width: 196mm !important;
    height: 283mm !important;
    max-height: 283mm !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    padding: 0 !important;
    overflow: hidden !important;
    visibility: visible !important;
    background: #ffffff !important;
    color: #0f172a !important;
    box-shadow: none !important;
    font-size: 7.2pt !important;
    line-height: 1.14 !important;
    break-after: avoid-page !important;
    page-break-after: avoid !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .assessment-print-root,
  .assessment-print-root * {
    visibility: visible !important;
    box-sizing: border-box !important;
  }

  .assessment-print-root * {
    color: #0f172a !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    border-color: #cbd5e1 !important;
  }

  .assessment-print-root h1 {
    font-size: 13pt !important;
    line-height: 1.05 !important;
    margin: 0.5mm 0 !important;
  }

  .assessment-print-root h2,
  .assessment-print-root h3 {
    font-size: 8pt !important;
    line-height: 1.08 !important;
    margin: 0 !important;
  }

  .assessment-print-root p,
  .assessment-print-root li,
  .assessment-print-root dt,
  .assessment-print-root dd,
  .assessment-print-root span {
    font-size: 6.9pt !important;
    line-height: 1.14 !important;
  }

  .assessment-print-root p,
  .assessment-print-root li {
    max-height: 2.3em;
    overflow: hidden !important;
  }

  .assessment-print-root .mt-5 { margin-top: 1.5mm !important; }
  .assessment-print-root .mt-4 { margin-top: 1mm !important; }
  .assessment-print-root .mt-3 { margin-top: 0.8mm !important; }
  .assessment-print-root .mt-2 { margin-top: 0.5mm !important; }
  .assessment-print-root .mt-1 { margin-top: 0.3mm !important; }
  .assessment-print-root .gap-5 { gap: 1.5mm !important; }
  .assessment-print-root .gap-4 { gap: 1mm !important; }
  .assessment-print-root .gap-3 { gap: 0.8mm !important; }
  .assessment-print-root .gap-2 { gap: 0.6mm !important; }

  .assessment-print-root [class~="p-5"],
  .assessment-print-root [class~="p-6"],
  .assessment-print-root [class~="sm:p-6"] {
    padding: 1.5mm !important;
  }

  .assessment-print-root [class~="p-4"] {
    padding: 1.2mm !important;
  }

  .assessment-print-root [class~="p-3"] {
    padding: 1mm !important;
  }

  .assessment-print-root [class~="px-5"],
  .assessment-print-root [class~="px-6"],
  .assessment-print-root [class~="sm:px-6"] {
    padding-left: 1.5mm !important;
    padding-right: 1.5mm !important;
  }

  .assessment-print-root [class~="py-5"],
  .assessment-print-root [class~="py-4"] {
    padding-top: 1.1mm !important;
    padding-bottom: 1.1mm !important;
  }

  .assessment-print-root [class~="py-3"],
  .assessment-print-root [class~="py-2"] {
    padding-top: 0.7mm !important;
    padding-bottom: 0.7mm !important;
  }

  .assessment-print-root [class*="overflow-hidden"] {
    overflow: visible !important;
  }

  /* The detailed criterion grid remains available in VIMS but is collapsed on paper.
     Each printed section keeps its title, score and recorded observation, which allows
     the complete assessment summary to fit on a single A4 page. */
  .assessment-print-root [class*="overflow-x-auto"] {
    display: none !important;
  }

  .assessment-print-root > .mt-5.space-y-4 {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 1mm !important;
    margin-top: 1.5mm !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * {
    margin-top: 0 !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :first-child {
    padding: 1mm 1.4mm !important;
    min-height: 8mm !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :last-child:not([class*="overflow-x-auto"]) {
    padding: 0.8mm 1.4mm !important;
    max-height: 6mm !important;
    overflow: hidden !important;
  }

  .assessment-print-root > .mt-5.grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 1.2mm !important;
    margin-top: 1.5mm !important;
  }

  .assessment-print-root > .mt-5.grid > * {
    min-width: 0 !important;
    max-height: 36mm !important;
    overflow: hidden !important;
  }

  .assessment-print-root ul {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.8mm !important;
    margin-top: 0.8mm !important;
  }

  .assessment-print-root li {
    padding: 0.7mm 1mm !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }

  .assessment-print-root dl {
    margin-top: 0.8mm !important;
  }

  .assessment-print-root dl > div {
    gap: 1.2mm !important;
    margin-top: 0.4mm !important;
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
        title="Print a compressed single-page A4 assessment summary"
      >
        <Printer className="h-4 w-4" />
        Print single-page A4
      </button>
    </>
  );
}
