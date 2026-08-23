"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Download, Loader2, Eye } from "lucide-react";

interface DocumentActionsProps {
  url: string;
  name: string;
}

export function DocumentActions({ url, name }: DocumentActionsProps) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      // For base64 data URLs, convert to blob
      if (url.startsWith("data:")) {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } else {
        // For regular URLs, just open in new tab
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download document");
    } finally {
      setDownloading(false);
    }
  }

  function handlePreview() {
    setPreviewing(true);
    if (url.startsWith("data:image/")) {
      // Open image in new tab
      window.open(url, "_blank");
    } else if (url.startsWith("data:application/pdf")) {
      // Open PDF in new tab
      window.open(url, "_blank");
    } else {
      // For other types, try to open
      window.open(url, "_blank");
    }
    setPreviewing(false);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePreview}
        disabled={previewing}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
        title="Preview"
      >
        <Eye className="h-4 w-4 text-slate-600" />
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50"
        title="Download"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
        ) : (
          <Download className="h-4 w-4 text-slate-600" />
        )}
      </button>
    </div>
  );
}
