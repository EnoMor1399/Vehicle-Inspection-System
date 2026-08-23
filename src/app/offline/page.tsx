import { ShieldCheck, WifiOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 grid place-items-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-red-500 grid place-items-center mx-auto mb-6">
          <WifiOff className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-950 mb-2">You&apos;re offline</h1>
          <p className="text-slate-600 mb-6">
            No internet connection. Your inspection data is safely stored on your device and will sync when you are back online.
          </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">What you can do offline:</p>
          <ul className="space-y-1 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Continue inspections in progress
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Capture photos and signatures
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              View cached vehicle records
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Scan QR codes for verification
            </li>
          </ul>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Retry connection
        </Link>

        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4" />
          Road Safety Limited · VIMS Offline Mode
        </div>
      </div>
    </div>
  );
}
