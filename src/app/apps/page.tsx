import { Card, Badge } from "@/components/ui";
import { ShieldCheck, Smartphone, Tablet, Monitor, Download, Wifi, WifiOff, QrCode, Fingerprint } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-400 to-red-500 grid place-items-center mb-4 shadow-2xl">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3">
            RSL VIMS on{" "}
            <span className="bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">
              Every Device
            </span>
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Inspect vehicles anywhere — from your phone, tablet, or desktop. Works online and offline with automatic sync.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <PlatformCard
            icon={<Smartphone className="h-8 w-8" />}
            title="iOS App"
            subtitle="iPhone & iPad"
            features={["Native camera integration", "Offline inspections", "Face ID login"]}
            cta="App Store"
            color="from-slate-700 to-slate-900"
          />
          <PlatformCard
            icon={<Smartphone className="h-8 w-8" />}
            title="Android App"
            subtitle="Phones & Tablets"
            features={["Hardware RFID support", "Offline mode", "Fingerprint login"]}
            cta="Google Play"
            color="from-emerald-700 to-emerald-900"
          />
          <PlatformCard
            icon={<Tablet className="h-8 w-8" />}
            title="PWA"
            subtitle="Any browser"
            features={["Installable", "Offline-first", "Auto-update"]}
            cta="Install Now"
            color="from-amber-600 to-amber-800"
            highlight
          />
          <PlatformCard
            icon={<Monitor className="h-8 w-8" />}
            title="Desktop"
            subtitle="Windows · Mac · Linux"
            features={["Full analytics", "Reports export", "Admin tools"]}
            cta="Open Web App"
            href="/"
            color="from-blue-700 to-blue-900"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <FeatureCard
            icon={<WifiOff className="h-5 w-5" />}
            title="Offline Inspections"
            desc="Continue inspections without internet. Auto-sync when reconnected."
          />
          <FeatureCard
            icon={<QrCode className="h-5 w-5" />}
            title="QR Scanner Built-in"
            desc="Scan vehicle QR codes and inspection certificates instantly."
          />
          <FeatureCard
            icon={<Fingerprint className="h-5 w-5" />}
            title="Biometric Login"
            desc="Face ID, Touch ID, and fingerprint authentication."
          />
        </div>

        <Card className="p-6 bg-white/5 backdrop-blur border-white/10 text-white">
          <h2 className="text-xl font-bold mb-4">Enterprise Integrations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IntegrationChip icon="🤖" label="AI Defect Detection" />
            <IntegrationChip icon="📡" label="RFID Scanners" />
            <IntegrationChip icon="📍" label="GPS Tracking" />
            <IntegrationChip icon="📊" label="Power BI" />
            <IntegrationChip icon="📑" label="Live Excel Sync" />
            <IntegrationChip icon="🔗" label="REST API" />
            <IntegrationChip icon="🎣" label="Webhooks" />
            <IntegrationChip icon="📱" label="Push Notifications" />
          </div>
        </Card>

        <div className="text-center mt-8 text-sm text-slate-400">
          <p>© 2026 Road Safety Limited · VIMS v2.0</p>
        </div>
      </div>
    </div>
  );
}

function PlatformCard({
  icon,
  title,
  subtitle,
  features,
  cta,
  color,
  href = "#",
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  features: string[];
  cta: string;
  color: string;
  href?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl p-6 bg-gradient-to-br ${color} text-white shadow-xl ${highlight ? "ring-2 ring-amber-400" : ""}`}>
      {highlight && (
        <Badge tone="amber" className="absolute top-3 right-3">Recommended</Badge>
      )}
      <div className="mb-4 opacity-90">{icon}</div>
      <h3 className="text-xl font-bold mb-1">{title}</h3>
      <p className="text-sm text-white/70 mb-4">{subtitle}</p>
      <ul className="space-y-1.5 mb-5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {f}
          </li>
        ))}
      </ul>
      <a
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition"
      >
        <Download className="h-4 w-4" />
        {cta}
      </a>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-5 text-white">
      <div className="h-10 w-10 rounded-lg bg-amber-500/20 text-amber-400 grid place-items-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-300">{desc}</p>
    </div>
  );
}

function IntegrationChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
