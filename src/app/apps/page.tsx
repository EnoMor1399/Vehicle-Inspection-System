import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import { PWAInstallCentre } from "@/components/PWAInstallCentre";
import {
  Apple,
  CheckCircle2,
  Globe2,
  Laptop,
  LockKeyhole,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TabletSmartphone,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { requireInternalUser } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  await requireInternalUser();

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Install & access</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">VIMS on mobile and desktop</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Install the same secure VIMS Progressive Web App on supported phones, tablets, laptops and desktop computers. The interface adapts to the screen size and updates automatically from the production web release.
              </p>
            </div>
            <Badge tone="emerald" className="w-fit">Cross-platform PWA</Badge>
          </div>
        </div>

        <PWAInstallCentre />

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Platform compatibility</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Supported installation paths</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              VIMS uses the browser’s native PWA installation support, so no separate application package is required.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PlatformCard
              icon={<Smartphone className="h-5 w-5" />}
              title="Android"
              browsers="Chrome / Chromium"
              install="Install app or Add to Home screen"
            />
            <PlatformCard
              icon={<Apple className="h-5 w-5" />}
              title="iPhone & iPad"
              browsers="Safari"
              install="Share → Add to Home Screen"
            />
            <PlatformCard
              icon={<Monitor className="h-5 w-5" />}
              title="Windows"
              browsers="Edge / Chrome"
              install="Address-bar install icon or Apps menu"
            />
            <PlatformCard
              icon={<Laptop className="h-5 w-5" />}
              title="macOS & Linux"
              browsers="Safari / Chrome / Edge / Chromium"
              install="Add to Dock or Install app"
            />
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<TabletSmartphone className="h-5 w-5" />}
            title="Responsive by design"
            desc="Navigation, forms, tables, buttons and dialogs adapt for phones, tablets, laptops and wide desktop monitors with touch-friendly controls on smaller screens."
          />
          <FeatureCard
            icon={<RefreshCw className="h-5 w-5" />}
            title="Automatic updates"
            desc="The installed PWA checks for updated application shell resources while the production web deployment remains the authoritative release source."
          />
          <FeatureCard
            icon={<LockKeyhole className="h-5 w-5" />}
            title="Secure local behavior"
            desc="Authenticated HTML and API records are not stored in the service-worker cache, reducing stale-data and shared-device exposure risk."
          />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                <Globe2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Browser compatibility notes</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Installation controls differ by browser. Chrome and Edge generally provide a direct install prompt. Safari on iPhone/iPad uses Add to Home Screen, while Safari on supported macOS versions uses Add to Dock.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />If an install prompt is unavailable, the App Access page shows the correct manual steps.</p>
              <p className="flex gap-2"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />For desktop Firefox environments without full PWA installation support, use current Chrome, Edge or Chromium for an installed-app experience.</p>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                <Wifi className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Installed does not mean offline records</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  VIMS remains an online operational system. Installation improves launch and app-window behavior, but inspection creation, record changes, evidence uploads, approvals and protected data access still require connectivity.
                </p>
                <Link href="/guide" className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:underline">
                  Open the full User Guide →
                </Link>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function PlatformCard({
  icon,
  title,
  browsers,
  install,
}: {
  icon: ReactNode;
  title: string;
  browsers: string;
  install: string;
}) {
  return (
    <Card className="p-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white">{icon}</div>
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{browsers}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{install}</p>
    </Card>
  );
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</div>
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p>
    </div>
  );
}
