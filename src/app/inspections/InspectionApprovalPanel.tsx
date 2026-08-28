"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveInspection } from "./server";
import { SignaturePad } from "@/components/SignaturePad";
import { Button, Card, TextArea } from "@/components/ui";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

export function InspectionApprovalPanel({
  inspectionId,
  requireSignature,
}: {
  inspectionId: string;
  requireSignature: boolean;
}) {
  const router = useRouter();
  const [remarks, setRemarks] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    if (requireSignature && !signature) {
      setError("A supervisor digital signature is required before approval.");
      return;
    }
    startTransition(async () => {
      try {
        await approveInspection(inspectionId, { remarks, signature });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval failed");
      }
    });
  }

  return (
    <Card className="mt-6 overflow-hidden border-0 ring-1 ring-blue-200">
      <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-950">Supervisor Authorization</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Review the completed inspection, record any supervisory remarks, and authorize the controlled certificate record.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Supervisor remarks</label>
          <TextArea
            rows={5}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Record review observations, conditions, or approval notes..."
            maxLength={4000}
          />
          <p className="mt-1 text-xs text-slate-500">Optional unless your internal procedure requires remarks.</p>
        </div>

        <SignaturePad
          label={requireSignature ? "Supervisor Digital Signature (required)" : "Supervisor Digital Signature"}
          value={signature}
          onChange={setSignature}
        />
      </div>

      {error && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs text-slate-600">
          Approval is audit-logged and links this inspection to the authenticated supervising officer.
        </p>
        <Button variant="success" onClick={approve} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Authorizing..." : "Approve Inspection"}
        </Button>
      </div>
    </Card>
  );
}
