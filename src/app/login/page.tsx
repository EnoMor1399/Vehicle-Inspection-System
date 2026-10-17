import { AuthForm } from "./AuthForm";
import { getSettings } from "@/lib/settings";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSettings();
  const allowPublicSignup = process.env.NODE_ENV !== "production"
    || process.env.ALLOW_PUBLIC_SIGNUP === "true";

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--vims-page)] p-3 pt-16 text-[var(--vims-ink)] sm:p-6 sm:pt-20 lg:p-8 lg:pt-20">

      <div className="relative mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] shadow-[var(--vims-shadow)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#0b1525] p-10 text-white dark:bg-[#050b13] lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${settings.themeColor}, ${settings.accentColor || settings.themeColor})` }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
            <div className="absolute -right-20 top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-8 top-36 h-48 w-48 rounded-full border border-white/10" />
            <div className="absolute bottom-0 left-0 h-56 w-56 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,.12),transparent_68%)]" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt={settings.companyName} className="h-12 w-12 rounded-xl bg-white object-contain p-1.5" />
              ) : (
                <div
                  className="grid h-12 w-12 place-items-center rounded-xl shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${settings.themeColor}, ${settings.accentColor || settings.themeColor})` }}
                >
                  <ShieldCheck className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{settings.companyName}</p>
                <p className="mt-0.5 text-xs text-slate-400">{settings.tagline || "Vehicle Inspection Management System"}</p>
              </div>
            </div>

            <div className="mt-16 max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Secure workspace</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-5xl">
                Vehicle inspection, made simpler.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
                Manage your fleet, inspections and compliance in one secure workspace.
              </p>
            </div>

            <div className="mt-10 border-l-2 border-emerald-400/60 pl-4 text-sm leading-6 text-slate-300">
              Inspection workflows · Certificate verification · Audit-ready records
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-slate-500">
            <span>VIMS Enterprise</span>
            <span>Authorized access only</span>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[var(--vims-panel-solid)] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt={settings.companyName} className="h-11 w-11 rounded-xl border border-[var(--vims-line)] bg-white object-contain p-1.5" />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white dark:bg-emerald-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--vims-ink)]">{settings.companyName}</p>
                <p className="text-xs text-[var(--vims-ink-muted)]">Secure VIMS access</p>
              </div>
            </div>

            <AuthForm allowSignUp={allowPublicSignup} />

            <div className="mt-6 border-t border-[var(--vims-line)] pt-5">
              <p className="text-sm text-[var(--vims-ink-muted)]">
                Setting up a company?{" "}
                <Link href="/subscribe" className="font-semibold text-emerald-700 underline underline-offset-4 hover:text-emerald-800">
                  Request a subscription
                </Link>
              </p>
              <p className="mt-4 text-xs leading-5 text-[var(--vims-ink-muted)]">
                Authorized access only. Activity may be recorded for security and audit purposes.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

