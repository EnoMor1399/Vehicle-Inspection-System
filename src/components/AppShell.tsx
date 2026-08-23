"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Pages that don't use the sidebar (public/auth pages)
const NO_SHELL_PATHS = ["/login"];
import {
  LayoutDashboard,
  Truck,
  Car,
  ClipboardCheck,
  ScrollText,
  ShieldCheck,
  Menu,
  X,
  MapPin,
  Users,
  Bell,
  Upload,
  FileBarChart,
  LogOut,
  FileText,
  Radio,
  Activity,
  Smartphone,
  Settings as SettingsIcon,
  BarChart3,
  CalendarCheck,
  BookOpen,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transporters", label: "Transporters", icon: Truck },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/daily-inspections", label: "Daily Pre-Trip", icon: CalendarCheck },
  { href: "/reports", label: "Reports & Analytics", icon: FileBarChart },
  { href: "/locations", label: "Stations", icon: MapPin },
  { href: "/users", label: "Users & Roles", icon: Users },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/import", label: "Import / Export", icon: Upload },
  { href: "/portal", label: "Transporter Portal", icon: Truck },
  { href: "/rfid", label: "RFID Scanner", icon: Radio },
  { href: "/predictive", label: "Predictive Maint.", icon: Activity },
  { href: "/apps", label: "Get the App", icon: Smartphone },
  { href: "/powerbi", label: "Power BI", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/api-docs", label: "API Docs", icon: FileBarChart },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/guide", label: "User Guide", icon: BookOpen },
];

export interface AppBranding {
  logoUrl?: string | null;
  companyName: string;
  tagline: string;
  footerText: string;
  themeColor: string;
  accentColor?: string;
}

const DEFAULT_BRANDING: AppBranding = {
  companyName: "Road Safety Limited",
  tagline: "VIMS Enterprise",
  footerText: "© 2026 Road Safety Limited · v2.0 Enterprise · ISO 27001",
  themeColor: "#039703",
  accentColor: "#026b02",
};

export function AppShell({ children, branding = DEFAULT_BRANDING }: { children: ReactNode; branding?: AppBranding }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Don't render sidebar for auth pages or verify pages
  if (NO_SHELL_PATHS.includes(pathname) || pathname.startsWith("/verify")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-slate-950 text-slate-100 flex flex-col transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.companyName} className="h-10 w-10 rounded-xl object-contain bg-white p-0.5" />
          ) : (
            <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: `linear-gradient(135deg, ${branding.themeColor}, ${branding.accentColor || "#026b02"})` }}>
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight truncate">{branding.companyName}</p>
            <p className="text-xs text-slate-400 leading-tight truncate">{branding.tagline}</p>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden ml-auto p-1 rounded hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5" /> Sign Out
            </button>
          </form>
          <div className="px-3 pt-3 text-xs text-slate-400">
            <p className="truncate">{branding.footerText}</p>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <p className="font-semibold">RSL VIMS</p>
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
