"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-slate-200 text-slate-500 shrink-0 transition-colors"
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <span className="text-xs text-emerald-600 font-medium">✓</span>
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
