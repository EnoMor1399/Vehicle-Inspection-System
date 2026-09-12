"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function DriverTrainingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[driver-training] route error", error);

    if (process.env.NODE_ENV !== "production") return;
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: "DriverTrainingRoute",
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center p-4 sm:p-6 lg:p-8">
      <div
        role="alert"
        className="w-full rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-6 shadow-[var(--vims-shadow-soft)] sm:p-8"
      >
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/45 dark:text-red-300 dark:ring-red-800">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--vims-ink)]">
              Driver Training could not load
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-[var(--vims-ink-muted)]">
              An unexpected error interrupted this Driver Training workspace. Retry the request or return to the department overview.
            </p>
            {error.digest && (
              <p className="mt-3 font-mono text-xs text-[var(--vims-ink-muted)]">
                Support reference: {error.digest}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--vims-ink)] px-4 py-2.5 text-sm font-semibold text-[var(--vims-panel-solid)] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/driver-training"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-4 py-2.5 text-sm font-semibold text-[var(--vims-ink)] shadow-sm transition-colors hover:bg-[var(--vims-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Department overview
          </Link>
        </div>
      </div>
    </div>
  );
}
