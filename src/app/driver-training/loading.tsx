export default function DriverTrainingLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Driver Training & Assessment"
      className="mx-auto max-w-[1500px] animate-pulse p-4 sm:p-6 lg:p-8 xl:p-10"
    >
      <span className="sr-only">Loading Driver Training & Assessment…</span>

      <div className="mb-6 space-y-3">
        <div className="h-8 w-72 max-w-full rounded-lg bg-[var(--vims-panel-soft)]" />
        <div className="h-4 w-[38rem] max-w-full rounded bg-[var(--vims-panel-soft)]" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-32 rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-5 shadow-[var(--vims-shadow-soft)]"
          >
            <div className="h-3 w-24 rounded bg-[var(--vims-panel-soft)]" />
            <div className="mt-4 h-8 w-16 rounded bg-[var(--vims-panel-soft)]" />
            <div className="mt-3 h-3 w-32 rounded bg-[var(--vims-panel-soft)]" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="min-h-72 rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-5 shadow-[var(--vims-shadow-soft)] sm:p-6"
          >
            <div className="h-4 w-40 rounded bg-[var(--vims-panel-soft)]" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="h-12 rounded-xl bg-[var(--vims-panel-soft)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
