export default function WrittenExamsLoading() {
  return (
    <div className="mx-auto max-w-[1600px] animate-pulse p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Loading written examination workspace">
      <div className="mb-6 h-9 w-72 rounded-lg bg-slate-200" />
      <div className="mb-5 h-72 rounded-2xl bg-slate-100" />
      <div className="mb-5 h-80 rounded-2xl bg-slate-100" />
      <div className="h-64 rounded-2xl bg-slate-100" />
    </div>
  );
}
