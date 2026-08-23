"use client";

import { useState } from "react";
import { X, Download, FileImage } from "lucide-react";
import type { InspectionPhoto } from "@/db/schema";

export function PhotoGallery({ photos }: { photos: InspectionPhoto[] }) {
  const [preview, setPreview] = useState<InspectionPhoto | null>(null);

  if (!photos || photos.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setPreview(photo)}
            className="relative h-14 w-14 rounded-md overflow-hidden ring-1 ring-slate-200 hover:ring-amber-500 transition"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.dataUrl} alt="Evidence" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center z-10"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.dataUrl}
            alt="Evidence"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 flex items-center gap-3">
            <p className="text-white text-xs">
              Captured {new Date(preview.takenAt).toLocaleString()}
            </p>
            <a
              href={preview.dataUrl}
              download={`evidence-${preview.id}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg"
            >
              <Download className="h-3 w-3" /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentList({ docs }: { docs: { id: string; name: string; dataUrl: string; type: string; size: number }[] }) {
  if (!docs || docs.length === 0) return null;

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-1.5">
      {docs.map((doc) => (
        <a
          key={doc.id}
          href={doc.dataUrl}
          download={doc.name}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200 transition"
        >
          <FileImage className="h-4 w-4 text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{doc.name}</p>
            <p className="text-xs text-slate-500">{formatSize(doc.size)}</p>
          </div>
          <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        </a>
      ))}
    </div>
  );
}
