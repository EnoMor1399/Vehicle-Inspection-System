"use client";

import { ArrowLeft, Printer, Share2, Download, ExternalLink, Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function CertificateToolbar({ inspectionId, verifyUrl }: { inspectionId: string; verifyUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function share() {
    if (navigator.share) {
      navigator.share({
        title: "Vehicle Inspection Certificate",
        text: "View the inspection certificate",
        url: verifyUrl,
      }).catch(() => {});
    } else {
      copyUrl();
    }
  }

  function downloadPdf() {
    // Trigger print dialog — user can "Save as PDF"
    window.print();
  }

  return (
    <div className="no-print sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/inspections/${inspectionId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inspection
          </Link>
          <div className="h-4 w-px bg-slate-300" />
          <p className="text-sm font-medium text-slate-900">Certificate Preview</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-xs">
            <ExternalLink className="h-3 w-3 text-slate-400" />
            <span className="font-mono text-slate-600 max-w-[200px] truncate">{verifyUrl}</span>
            <button
              onClick={copyUrl}
              className="ml-1 p-1 rounded hover:bg-slate-200 text-slate-500"
              title="Copy URL"
            >
              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>

          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <button
            onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
