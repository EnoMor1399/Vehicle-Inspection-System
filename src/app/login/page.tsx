import { AuthForm } from "./AuthForm";
import { getSettings } from "@/lib/settings";
import { CheckCircle2, ClipboardCheck, QrCode, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef2f6] p-3 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-slate-900/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative hidden overflow-hidden bg-[#0b1525] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
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

            <div className="mt-20 max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Enterprise operations</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-5xl">
                Controlled inspection operations in one secure workspace.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
                Manage vehicle records, inspections, approvals, certificates, compliance reporting, and audit history with clear operational controls.
              </p>
            </div>

            <div className="mt-10 grid gap-3">
              <Feature icon={<ClipboardCheck className="h-4 w-4" />} title="Structured inspection workflow" text="From inspection capture through review and authorization." />
              <Feature icon={<QrCode className="h-4 w-4" />} title="Signed certificate verification" text="QR-based certificate validation with controlled status checks." />
              <Feature icon={<CheckCircle2 className="h-4 w-4" />} title="Auditable administration" text="Roles, security events, approvals, and operational history." />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-[11px] text-slate-500">
            <span>VIMS Enterprise</span>
            <span>Authorized access only</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt={settings.companyName} className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-contain p-1.5" />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-950">{settings.companyName}</p>
                <p className="text-xs text-slate-500">Secure VIMS access</p>
              </div>
            </div>

            <AuthForm />

            <p className="mt-7 text-center text-[11px] leading-5 text-slate-400">
              By signing in, you are accessing a controlled business system. Activity may be logged for security and audit purposes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
      </div>
    </div>
  );
}
