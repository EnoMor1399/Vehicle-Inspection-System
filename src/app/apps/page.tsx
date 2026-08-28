import type { ReactNode } from "react";
import { Card, Badge } from "@/components/ui";
import { ShieldCheck, Smartphone, Monitor, Wifi, LockKeyhole, RefreshCw, Globe2 } from "lucide-react";
import Link from "next/link";
import { requireInternalUser } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  await requireInternalUser();

  return (
    <div className="p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Secure access</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">VIMS across your approved devices</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Use the responsive web application on desktop, tablet, or mobile. Supported browsers can install the same web application as a PWA for a focused app-like experience.
              </p>
            </div>
            <Badge tone="emerald" className="w-fit">Enterprise Web + PWA</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AccessCard
            icon={<Monitor className="h-6 w-6" />}
            title="Desktop Web"
            description="Full operational workspace for administration, analytics, certificates, approvals and reporting."
            action={<Link href="/" className="text-sm font-semibold text-blue-700 hover:underline">Open workspace →</Link>}
          />
          <AccessCard
            icon={<Smartphone className="h-6 w-6" />}
            title="Mobile & Tablet Web"
            description="Responsive inspection workflows, evidence capture, signatures and QR verification in a modern browser."
            action={<span className="text-xs font-medium text-slate-500">No separate mobile download required</span>}
          />
          <AccessCard
            icon={<Globe2 className="h-6 w-6" />}
            title="Progressive Web App"
            description="Install VIMS from a supported browser. The install prompt appears automatically when browser requirements are met."
            action={<span className="text-xs font-medium text-slate-500">Install from your browser prompt</span>}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard icon={<LockKeyhole className="h-5 w-5" />} title="Protected operational data" desc="Authenticated pages and API records are not persisted by the service-worker cache on shared devices." />
          <FeatureCard icon={<Wifi className="h-5 w-5" />} title="Connected transactions" desc="Creating, approving and changing inspection records requires a live network connection so the database remains authoritative." />
          <FeatureCard icon={<RefreshCw className="h-5 w-5" />} title="Automatic web updates" desc="New production releases are delivered through the web deployment; users do not need to download application packages." />
        </div>

        <Card className="mt-6 p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="font-semibold text-slate-950">Native iOS and Android applications</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Native App Store / Google Play packages, device biometrics and native RFID SDK integrations are not included in this repository. They should only be advertised after dedicated mobile applications and distribution accounts are implemented and verified.
              </p>
            </div>
            <Badge tone="slate">Not included in V2.2</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AccessCard({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-white">{icon}</div>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4 border-t border-slate-100 pt-4">{action}</div>
    </Card>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700">{icon}</div>
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}
