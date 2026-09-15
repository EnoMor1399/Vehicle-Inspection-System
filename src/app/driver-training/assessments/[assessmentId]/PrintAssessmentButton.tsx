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
    color: #111827 !important;
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
    --border-subtle: #d1d5db;
    --border-strong: #94a3b8;
    --text-primary: #111827;
    --text-secondary: #374151;
    --text-muted: #64748b;
    --vims-page: #ffffff;
    --vims-page-deep: #ffffff;
    --vims-panel: #ffffff;
    --vims-panel-solid: #ffffff;
    --vims-panel-soft: #f8fafc;
    --vims-line: #d1d5db;
    --vims-line-strong: #94a3b8;
    --vims-ink: #111827;
    --vims-ink-soft: #374151;
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
    padding: 3.2mm 3.5mm 3mm !important;
    overflow: hidden !important;
    visibility: visible !important;
    background: #ffffff !important;
    color: #111827 !important;
    border: 0.3mm solid #475569 !important;
    border-top: 1.6mm solid #0f172a !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 7.2pt !important;
    line-height: 1.14 !important;
    break-after: avoid-page !important;
    page-break-after: avoid !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .assessment-print-root::before {
    content: "VEHICLE INSPECTION MANAGEMENT SYSTEM   •   DRIVER TRAINING & ASSESSMENT SERVICES";
    display: block !important;
    margin: 0 0 1.5mm !important;
    padding: 0 0 1.2mm !important;
    border-bottom: 0.35mm solid #0f172a !important;
    color: #0f172a !important;
    font-size: 7.1pt !important;
    font-weight: 800 !important;
    letter-spacing: 0.11em !important;
    line-height: 1.15 !important;
    text-align: center !important;
  }

  .assessment-print-root::after {
    content: "Assessment summary • Detailed criterion ratings and supporting evidence remain available in the digital VIMS record.";
    display: block !important;
    margin-top: 1.3mm !important;
    padding-top: 1mm !important;
    border-top: 0.25mm solid #94a3b8 !important;
    color: #64748b !important;
    font-size: 5.8pt !important;
    line-height: 1.15 !important;
    letter-spacing: 0.02em !important;
    text-align: center !important;
  }

  .assessment-print-root,
  .assessment-print-root * {
    visibility: visible !important;
    box-sizing: border-box !important;
  }

  .assessment-print-root * {
    color: #111827 !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    border-color: #d1d5db !important;
  }

  .assessment-print-root h1 {
    font-size: 13.2pt !important;
    line-height: 1.02 !important;
    font-weight: 800 !important;
    letter-spacing: -0.015em !important;
    margin: 0.4mm 0 !important;
  }

  .assessment-print-root h2,
  .assessment-print-root h3 {
    font-size: 7.8pt !important;
    line-height: 1.08 !important;
    font-weight: 750 !important;
    margin: 0 !important;
  }

  .assessment-print-root p,
  .assessment-print-root li,
  .assessment-print-root dt,
  .assessment-print-root dd,
  .assessment-print-root span {
    font-size: 6.8pt !important;
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
    padding-top: 1.05mm !important;
    padding-bottom: 1.05mm !important;
  }

  .assessment-print-root [class~="py-3"],
  .assessment-print-root [class~="py-2"] {
    padding-top: 0.65mm !important;
    padding-bottom: 0.65mm !important;
  }

  .assessment-print-root > .print\\:hidden + * {
    border: 0.35mm solid #475569 !important;
    border-radius: 0 !important;
    overflow: hidden !important;
  }

  .assessment-print-root > .print\\:hidden + * > :first-child {
    background: #ffffff !important;
    border-bottom: 0.45mm solid #0f172a !important;
    padding-top: 1.4mm !important;
    padding-bottom: 1.4mm !important;
  }

  .assessment-print-root > .print\\:hidden + * > :first-child p:first-child {
    color: #475569 !important;
    font-size: 6.2pt !important;
    font-weight: 800 !important;
    letter-spacing: 0.14em !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(2) {
    display: grid !important;
    grid-template-columns: 0.9fr 1.15fr 0.9fr 1.65fr !important;
    gap: 0 !important;
    background: #e2e8f0 !important;
    border-bottom: 0.25mm solid #94a3b8 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(2) > * {
    min-width: 0 !important;
    padding: 1.25mm 1.4mm !important;
    background: #f8fafc !important;
    border-right: 0.2mm solid #cbd5e1 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(2) > *:last-child {
    border-right: 0 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(2) p:first-child {
    color: #64748b !important;
    font-size: 5.6pt !important;
    font-weight: 800 !important;
    letter-spacing: 0.08em !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(2) p:last-child {
    color: #0f172a !important;
    font-size: 7.2pt !important;
    font-weight: 800 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(3) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 0 !important;
    padding: 1.5mm !important;
    background: #ffffff !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(3) > * {
    min-width: 0 !important;
    padding: 0 1.5mm !important;
    border-right: 0.2mm solid #d1d5db !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(3) > *:first-child {
    padding-left: 0 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(3) > *:last-child {
    padding-right: 0 !important;
    border-right: 0 !important;
  }

  .assessment-print-root > .print\\:hidden + * > :nth-child(3) h2 {
    color: #475569 !important;
    font-size: 5.8pt !important;
    letter-spacing: 0.1em !important;
    border-bottom: 0.2mm solid #cbd5e1 !important;
    padding-bottom: 0.6mm !important;
    margin-bottom: 0.7mm !important;
  }

  .assessment-print-root dl {
    margin-top: 0.4mm !important;
  }

  .assessment-print-root dl > div {
    gap: 1.2mm !important;
    margin-top: 0.35mm !important;
  }

  .assessment-print-root dt {
    color: #64748b !important;
  }

  .assessment-print-root dd {
    color: #111827 !important;
    font-weight: 650 !important;
  }

  .assessment-print-root [class*="overflow-hidden"] {
    overflow: visible !important;
  }

  /* Detailed criterion rows stay available in the digital record. The printed report
     carries the controlled section score and observation summary to preserve one-page A4. */
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
    min-width: 0 !important;
    border: 0.25mm solid #94a3b8 !important;
    border-left: 0.85mm solid #475569 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :first-child {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: center !important;
    gap: 1mm !important;
    padding: 0.9mm 1.2mm !important;
    min-height: 7.5mm !important;
    background: #f8fafc !important;
    border-bottom: 0.2mm solid #cbd5e1 !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :first-child p {
    color: #64748b !important;
    font-size: 5.5pt !important;
    font-weight: 800 !important;
    letter-spacing: 0.08em !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :first-child h2 {
    color: #111827 !important;
    font-size: 6.8pt !important;
    font-weight: 750 !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :first-child > :last-child {
    color: #0f172a !important;
    font-size: 7pt !important;
    font-weight: 800 !important;
    white-space: nowrap !important;
  }

  .assessment-print-root > .mt-5.space-y-4 > * > :last-child:not([class*="overflow-x-auto"]) {
    padding: 0.75mm 1.2mm !important;
    max-height: 5.5mm !important;
    overflow: hidden !important;
    background: #ffffff !important;
  }

  .assessment-print-root > .mt-5.grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 1mm !important;
    margin-top: 1.5mm !important;
  }

  .assessment-print-root > .mt-5.grid > * {
    min-width: 0 !important;
    max-height: 35mm !important;
    overflow: hidden !important;
    border: 0.25mm solid #94a3b8 !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    padding: 1.2mm 1.4mm !important;
  }

  .assessment-print-root > .mt-5.grid > * > h2 {
    color: #0f172a !important;
    font-size: 6.4pt !important;
    font-weight: 800 !important;
    letter-spacing: 0.07em !important;
    text-transform: uppercase !important;
    padding-bottom: 0.6mm !important;
    margin-bottom: 0.6mm !important;
    border-bottom: 0.25mm solid #94a3b8 !important;
  }

  .assessment-print-root > .mt-5.grid > * p[class*="uppercase"] {
    color: #64748b !important;
    font-size: 5.3pt !important;
    letter-spacing: 0.07em !important;
  }

  .assessment-print-root > .mt-5.grid > * p[class*="whitespace-pre-wrap"] {
    color: #374151 !important;
    line-height: 1.12 !important;
    max-height: 2.25em !important;
  }

  .assessment-print-root ul {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.7mm !important;
    margin-top: 0.7mm !important;
  }

  .assessment-print-root li {
    padding: 0.65mm 0.9mm !important;
    border-radius: 0 !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }

  .assessment-print-root > .mt-5.border-red-200 {
    border: 0.25mm solid #7f1d1d !important;
    border-left: 1mm solid #7f1d1d !important;
    border-radius: 0 !important;
    background: #fff !important;
  }

  .assessment-print-root > .mt-5.border-red-200 h2,
  .assessment-print-root > .mt-5.border-red-200 strong {
    color: #7f1d1d !important;
  }

  .assessment-print-root > .mt-5.p-5:last-of-type,
  .assessment-print-root > .mt-5.sm\\:p-6:last-of-type {
    border: 0.3mm solid #475569 !important;
    border-radius: 0 !important;
    background: #f8fafc !important;
    padding: 1.15mm 1.4mm !important;
    max-height: 20mm !important;
    overflow: hidden !important;
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

  .assessment-print-root [class*="rounded-xl"],
  .assessment-print-root [class*="rounded-2xl"] {
    border-radius: 0 !important;
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
        title="Print a formal single-page A4 assessment report"
      >
        <Printer className="h-4 w-4" />
        Print formal A4 report
      </button>
    </>
  );
}
