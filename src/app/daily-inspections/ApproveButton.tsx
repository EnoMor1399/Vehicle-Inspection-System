"use client";

import { useState, useTransition } from "react";
import { approveDailyInspection } from "./server";
import { Button } from "@/components/ui";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ApproveButton({ inspectionId }: { inspectionId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleApprove() {
    if (!confirm("Approve this daily inspection? This confirms supervisor review.")) return;
    startTransition(async () => {
      try {
        await approveDailyInspection(inspectionId);
        setDone(true);
      } catch (err: any) {
        alert(err.message || "Approval failed");
      }
    });
  }

  if (done) {
    return <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</Badge>;
  }

  return (
    <Button variant="secondary" onClick={handleApprove} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      Approve
    </Button>
  );
}

function Badge({ tone, children }: { tone: "emerald"; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">{children}</span>;
}
