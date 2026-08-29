"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Printer,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied by the browser; sharing/verification remains available.
    }
  }

  function share() {
    if (navigator.share) {
      navigator
        .share({
          title: vehicleRegistration
            ? `Vehicle Inspection Certificate — ${vehicleRegistration}`
            : "Vehicle Inspection Certificate",
          text: "View and verify this VIMS vehicle inspection certificate.",
          url: verifyUrl,
        })
        .catch(() => {});
      return;
    }
    copyUrl();
  }

  return (
    <div className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
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
            Certificate{vehicleRegistration ? ` • ${vehicleRegistration}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden max-w-[250px] items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs ring-1 ring-slate-200 lg:flex">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <a
            href={`/api/certificates/${inspectionId}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>

          <button
            onClick={() => window.print()}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
