"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  Car,
  ChevronRight,
  ClipboardCheck,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Radio,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Truck,
  Upload,
  Users,
  X,
} from "lucide-react";

const NO_SHELL_PATHS = ["/login"];

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/vehicles", label: "Vehicles", icon: Car },
      { href: "/transporters", label: "Transporters", icon: Truck },
      { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
      { href: "/daily-inspections", label: "Daily Pre-Trip", icon: CalendarCheck },
      { href: "/locations", label: "Stations", icon: MapPin },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/reports", label: "Reports & Analytics", icon: FileBarChart },
      { href: "/predictive", label: "Maintenance Risk", icon: Activity },
      { href: "/powerbi", label: "Power BI", icon: BarChart3 },
      { href: "/rfid", label: "RFID Operations", icon: Radio },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Users & Roles", icon: Users },
      { href: "/documents", label: "Documents", icon: FileText },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/import", label: "Import / Export", icon: Upload },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
      { href: "/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
  {
    label: "Access & Support",
    items: [
      { href: "/portal", label: "Transporter Portal", icon: Truck },
      { href: "/apps", label: "App Access", icon: Smartphone },
      { href: "/api-docs", label: "API & Integrations", icon: FileBarChart },
      { href: "/guide", label: "User Guide", icon: BookOpen },
    ],
  },
];

const TRANSPORTER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Your Workspace",
    items: [
      { href: "/portal", label: "Transporter Portal", icon: Truck },
    ],
  },
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
  tagline: "Vehicle Inspection Management System",
  footerText: "© 2026 Road Safety Limited · VIMS Enterprise",
  themeColor: "#039703",
  accentColor: "#026b02",
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function AppShell({
  children,
  branding = DEFAULT_BRANDING,
  userRole,
  userName,
}: {
  children: ReactNode;
  branding?: AppBranding;
  userRole?: string | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isTransporter = userRole === "transporter_user";
  const navGroups = isTransporter ? TRANSPORTER_NAV_GROUPS : NAV_GROUPS;

  const activeContext = (() => {
    for (const group of navGroups) {
      const item = group.items.find((candidate) => isActivePath(pathname, candidate.href));
      if (item) return { group: group.label, item };
    }
    return null;
  })();

  if (NO_SHELL_PATHS.includes(pathname) || pathname.startsWith("/verify") || pathname.startsWith("/certificate")) {
    return <>{children}</>;
  }

  return (
    <div data-app-shell className="app-shell min-h-screen lg:flex">
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-white/10 bg-[#0b1525] text-slate-100 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-4 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.045] p-3 ring-1 ring-white/[0.06]">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-11 w-11 rounded-xl bg-white object-contain p-1.5 shadow-sm"
              />
            ) : (
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${branding.themeColor}, ${branding.accentColor || "#026b02"})` }}
              >
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-white">{branding.companyName}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {isTransporter ? "Transporter Portal" : (branding.tagline || "Inspection Operations")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.10)]" />
              {isTransporter ? "Transporter account" : "Secure workspace"}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 font-medium text-slate-300">
              {isTransporter ? "SCOPED" : "V2.3 UI"}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-white text-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                          : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full"
                          style={{ backgroundColor: branding.themeColor }}
                        />
                      )}
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${
                          active ? "text-[var(--brand-color)]" : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {isTransporter && (
          <div className="mx-3 mb-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3 text-xs leading-relaxed text-slate-400">
            Your account is limited to the fleet, inspections and compliance records linked to your transporter profile.
          </div>
        )}

        <div className="border-t border-white/10 p-3">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out securely
            </button>
          </form>
          <p className="mt-2 truncate px-3 text-[10px] text-slate-600">{branding.footerText}</p>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1 bg-[var(--surface-page)]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                <span>{isTransporter ? "TRANSPORTER" : "VIMS"}</span>
                <ChevronRight className="h-3 w-3" />
                <span className="truncate">{activeContext?.group || (isTransporter ? "Your Workspace" : "Workspace")}</span>
              </div>
              <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-950">
                {activeContext?.item.label || (isTransporter ? "Transporter Workspace" : "Vehicle Inspection Management")}
              </p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {isTransporter ? `${userName || "Transporter"} · Scoped access` : "Protected session"}
              </div>
            </div>
          </div>
        </header>

        <main className="app-shell-content min-h-[calc(100vh-65px)] overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
