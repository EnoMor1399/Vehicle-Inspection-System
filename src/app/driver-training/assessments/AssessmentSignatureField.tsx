"use client";

import { useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";

export function AssessmentSignatureField({
  name,
  label,
  required = false,
  hint,
  initialValue = "",
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  initialValue?: string;
}) {
  const [signature, setSignature] = useState(initialValue);

  return (
    <div>
      <SignaturePad
        label={`${label}${required ? " (required)" : ""}`}
        value={signature}
        onChange={setSignature}
      />
      <input type="hidden" name={name} value={signature} />
      {hint ? <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">{hint}</p> : null}
    </div>
  );
}
