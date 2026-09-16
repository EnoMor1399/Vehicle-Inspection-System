"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { Button, Field, Select } from "@/components/ui";

type AssessmentOption = {
  id: string;
  label: string;
};

type Props = {
  assessments: AssessmentOption[];
  storageConfigured: boolean;
};

type Notice = { tone: "success" | "error"; text: string } | null;

const MAX_FILE_BYTES = 4_000_000;

export function WrittenExamEvidenceUpload({ assessments, storageConfigured }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setNotice({ tone: "error", text: "Select a written exam file to upload." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setNotice({ tone: "error", text: "Each file must be 4 MB or smaller." });
      return;
    }

    setUploading(true);
    try {
      const response = await fetch("/api/driver-training/written-exams/upload", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; document?: { name?: string } } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "The written exam file could not be uploaded.");
      }

      setNotice({ tone: "success", text: "Written exam evidence uploaded and linked to the assessment." });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The written exam file could not be uploaded.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t border-[var(--vims-line)] bg-[var(--vims-panel-soft)]/50 px-5 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--vims-ink)]">Upload written exam evidence</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">
              Attach the scanned Theory paper, Road Signs paper, answer script or marking sheet to the driver&apos;s assessment record.
              Files are stored privately and can only be opened by authorized Driver Training users.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5" /> Private evidence
        </span>
      </div>

      {!storageConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Private document storage needs configuration</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Connect a private Vercel Blob store to this VIMS project and provide BLOB_READ_WRITE_TOKEN before uploads can be accepted.
          </p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-xl border border-[var(--vims-line)] bg-white px-4 py-3 text-sm text-[var(--vims-ink-muted)]">
          Complete a driver assessment before uploading written examination evidence.
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,.75fr)_minmax(0,1.25fr)_auto] xl:items-end">
          <Field label="Assessment record" required>
            <Select name="assessmentId" required defaultValue="">
              <option value="" disabled>Select driver assessment</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>{assessment.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Evidence type" required>
            <Select name="evidenceType" required defaultValue="theory">
              <option value="theory">Theory paper</option>
              <option value="road_signs">Road Signs paper</option>
              <option value="answer_script">Answer script</option>
              <option value="marking_sheet">Marking / result sheet</option>
              <option value="other">Other evidence</option>
            </Select>
          </Field>

          <Field label="Exam file" required>
            <input
              ref={fileRef}
              name="file"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="block h-10 w-full rounded-lg border border-[var(--vims-line)] bg-white px-3 py-2 text-sm text-[var(--vims-ink)] file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
            />
          </Field>

          <Button type="submit" disabled={uploading} className="xl:mb-[1px]">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--vims-ink-muted)]">
        <span>Accepted: PDF, JPEG, PNG, WebP</span>
        <span>Maximum: 4 MB per file</span>
        <span>Multiple files can be attached to one assessment</span>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {notice.tone === "success" ? <FileCheck2 className="h-4 w-4" /> : null}
          {notice.text}
        </div>
      )}
    </div>
  );
}
