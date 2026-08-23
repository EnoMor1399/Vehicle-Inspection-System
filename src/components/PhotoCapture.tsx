"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X, FileImage, Image as ImageIcon, ZoomIn } from "lucide-react";

export interface Photo {
  id: string;
  dataUrl: string;
  caption?: string;
  takenAt: string;
}

interface PhotoCaptureProps {
  value: Photo[];
  onChange: (photos: Photo[]) => void;
  maxPhotos?: number;
  label?: string;
}

export function PhotoCapture({ value, onChange, maxPhotos = 5, label }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxPhotos - value.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    Promise.all(
      filesToProcess.map(
        (file) =>
          new Promise<Photo>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              // Compress if larger than 500KB
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let { width, height } = img;

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                  const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                  width = Math.round(width * ratio);
                  height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                resolve({
                  id: Math.random().toString(36).slice(2),
                  dataUrl,
                  takenAt: new Date().toISOString(),
                });
              };
              img.onerror = () => {
                resolve({
                  id: Math.random().toString(36).slice(2),
                  dataUrl: e.target?.result as string,
                  takenAt: new Date().toISOString(),
                });
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          })
      )
    ).then((newPhotos) => {
      onChange([...value, ...newPhotos]);
      setShowMenu(false);
    });
  }

  function removePhoto(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }

  const canAdd = value.length < maxPhotos;

  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> {label}
        </p>
      )}

      {/* Photo grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-2">
          {value.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.dataUrl}
                alt="Evidence"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setPreview(photo)}
              />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-red-600 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setPreview(photo)}
                className="absolute bottom-0.5 right-0.5 h-5 w-5 rounded-full bg-black/50 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      {canAdd && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 hover:border-amber-500 hover:text-amber-700 hover:bg-amber-50 transition"
          >
            <Camera className="h-3.5 w-3.5" />
            Add Photo ({value.length}/{maxPhotos})
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute z-20 mt-1 w-48 rounded-lg bg-white shadow-lg ring-1 ring-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded"
                >
                  <Camera className="h-4 w-4 text-amber-600" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded"
                >
                  <Upload className="h-4 w-4 text-blue-600" />
                  Upload from Device
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Lightbox preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center"
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
          <p className="absolute bottom-4 text-white text-xs">
            Captured {new Date(preview.takenAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

// Document upload component
interface DocumentUploadProps {
  value: { id: string; name: string; dataUrl: string; type: string; size: number }[];
  onChange: (docs: { id: string; name: string; dataUrl: string; type: string; size: number }[]) => void;
  maxDocs?: number;
}

export function DocumentUpload({ value, onChange, maxDocs = 10 }: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxDocs - value.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    Promise.all(
      filesToProcess.map(
        (file) =>
          new Promise<{ id: string; name: string; dataUrl: string; type: string; size: number }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                id: Math.random().toString(36).slice(2),
                name: file.name,
                dataUrl: e.target?.result as string,
                type: file.type,
                size: file.size,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    ).then((newDocs) => {
      onChange([...value, ...newDocs]);
    });
  }

  function removeDoc(id: string) {
    onChange(value.filter((d) => d.id !== id));
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const canAdd = value.length < maxDocs;

  return (
    <div>
      {value.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {value.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 ring-1 ring-slate-200">
              <FileImage className="h-4 w-4 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{doc.name}</p>
                <p className="text-xs text-slate-500">{formatSize(doc.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeDoc(doc.id)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Document ({value.length}/{maxDocs})
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
