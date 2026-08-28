import { ShieldCheck, WifiOff, ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-800 grid place-items-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 text-center shadow-2xl">
        <div className="h-20 w-20 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mx-auto mb-6">
          <WifiOff className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950 mb-2">Network connection unavailable</h1>
        <p className="text-slate-600 mb-6">
          VIMS protects operational and personal records by requiring a live connection for authenticated data and submissions.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left ring-1 ring-slate-200">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Secure offline behavior</p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2"><LockKeyhole className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />Authenticated pages and API responses are not stored in the service-worker cache.</li>
            <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />Reconnect before creating, approving, or changing inspection records.</li>
          </ul>
        </div>

        <Link href="/" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> Retry connection
        </Link>

        <p className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500">Road Safety Limited · VIMS secure offline shell</p>
      </div>
    </div>
  );
}
