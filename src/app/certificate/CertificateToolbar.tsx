"use client";

import { ArrowLeft, Printer, Share2, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Keep print-time overrides last in the cascade so the generated A4 certificate is preserved exactly.
const PRINT_STYLE_ID = "vims-certificate-exact-print";

export function CertificateToolbar({
  inspectionId,
  vehicleRegistration,
  verifyUrl,
}: {
  inspectionId: string;
  vehicleRegistration?: string;
  verifyUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  }

  function share() {
    if (navigator.share) {
      navigator
        .share({
          title: vehicleRegistration
            ? `Vehicle Inspection Certificate — ${vehicleRegistration}`
            : "Vehicle Inspection Certificate",
          text: "View and verify this vehicle inspection certificate.",
          url: verifyUrl,
        })
        .catch(() => {});
    } else {
      copyUrl();
    }
  }

  function printCertificate() {
    document.getElementById(PRINT_STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent = `
      @page {
        size: A4 portrait;
        margin: 0;
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          height: 297mm !important;
          min-width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .no-print {
          display: none !important;
        }

        .certificate-screen {
          box-sizing: border-box !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }

        .certificate-document {
          box-sizing: border-box !important;
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 8mm 9mm 7mm !important;
          overflow: hidden !important;
          border: 1px solid #d7dee4 !important;
          box-shadow: none !important;
          transform: none !important;
          zoom: 1 !important;
          page-break-before: avoid !important;
          page-break-after: avoid !important;
          break-before: avoid-page !important;
          break-after: avoid-page !important;
        }

        .cert-letterhead {
          gap: 18px !important;
          min-height: 23mm !important;
          padding-bottom: 1mm !important;
        }

        .cert-brand {
          gap: 12px !important;
        }

        .cert-logo {
          width: 64px !important;
          height: 64px !important;
          flex: 0 0 64px !important;
        }

        .cert-logo svg {
          width: 46px !important;
          height: 46px !important;
        }

        .cert-brand h2 {
          max-width: 108mm !important;
          font-size: 24px !important;
          line-height: 1.02 !important;
          font-weight: 900 !important;
          letter-spacing: 0.012em !important;
        }

        .cert-brand p {
          margin-top: 4px !important;
          font-size: 8.5px !important;
          font-weight: 800 !important;
        }

        .cert-contact-list {
          width: 55mm !important;
          padding-left: 12px !important;
        }

        .cert-contact-line p {
          font-size: 6.9px !important;
          font-weight: 700 !important;
        }

        .cert-top-rule {
          margin-top: 0.5mm !important;
          margin-bottom: 1.6mm !important;
        }

        .cert-top-rule p {
          font-size: 7px !important;
          font-weight: 900 !important;
        }

        .cert-title {
          margin-bottom: 1.7mm !important;
        }

        .cert-title h1 {
          font-size: 22px !important;
          font-weight: 900 !important;
          letter-spacing: 0.04em !important;
        }

        .cert-title p {
          font-weight: 700 !important;
        }

        .certificate-document,
        .certificate-document *,
        .certificate-document::before,
        .certificate-document::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .cert-letterhead,
        .cert-main-band,
        .cert-checklist-summary,
        .cert-lower-grid,
        .cert-authorization-row,
        .cert-footer {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `;

    document.head.appendChild(style);

    const cleanup = () => {
      document.getElementById(PRINT_STYLE_ID)?.remove();
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/inspections/${inspectionId}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inspection
          </Link>
          <div className="hidden h-4 w-px bg-slate-300 sm:block" />
          <p className="truncate text-sm font-semibold text-slate-900">
            Certificate Preview{vehicleRegistration ? ` • ${vehicleRegistration}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex max-w-[320px] items-center gap-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs ring-1 ring-slate-200">
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="truncate font-mono text-slate-600">{verifyUrl}</span>
            <button
              onClick={copyUrl}
              className="ml-1 rounded p-1 text-slate-500 hover:bg-slate-200"
              title="Copy verification URL"
              type="button"
            >
              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <button
            onClick={share}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <button
            onClick={printCertificate}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
