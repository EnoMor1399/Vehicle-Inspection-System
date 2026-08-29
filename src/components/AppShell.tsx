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

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrator",
  admin: "Administrator",
  operations_manager: "Operations Manager",
  supervisor: "Supervisor",
  inspector: "Inspector",
  data_entry: "Data Entry Officer",
  auditor: "Auditor",
  compliance_officer: "Compliance Officer",
  viewer: "Viewer",
  transporter_user: "Transporter Portal User",
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  resource?: string;
  superAdminOnly?: boolean;
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
      { href: "/vehicles", label: "Vehicles", icon: Car, resource: "vehicles" },
      { href: "/transporters", label: "Transporters", icon: Truck, resource: "transporters" },
      { href: "/inspections", label: "Inspections", icon: ClipboardCheck, resource: "inspections" },
      { href: "/daily-inspections", label: "Daily Pre-Trip", icon: CalendarCheck, resource: "inspections" },
      { href: "/locations", label: "Stations", icon: MapPin, resource: "locations" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/reports", label: "Reports & Analytics", icon: FileBarChart, resource: "reports" },
      { href: "/predictive", label: "Maintenance Risk", icon: Activity, resource: "reports" },
      { href: "/powerbi", label: "Power BI", icon: BarChart3, resource: "reports" },
      { href: "/rfid", label: "RFID Operations", icon: Radio, resource: "vehicles" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Users & Roles", icon: Users, resource: "users" },
      { href: "/documents", label: "Documents", icon: FileText, resource: "documents" },
      { href: "/notifications", label: "Notifications", icon: Bell, resource: "notifications" },
      { href: "/import", label: "Import / Export", icon: Upload, resource: "import" },
      { href: "/settings", label: "Settings", icon: SettingsIcon, resource: "settings" },
      { href: "/audit", label: "Audit Log", icon: ScrollText, resource: "audit" },
    ],
  },
  {
    label: "Access & Support",
    items: [
      { href: "/portal", label: "Transporter Portal", icon: Truck, superAdminOnly: true },
      { href: "/apps", label: "App Access", icon: Smartphone },
      { href: "/api-docs", label: "API & Integrations", icon: FileBarChart, resource: "settings" },
      { href: "/guide", label: "User Guide", icon: BookOpen },
    ],
  },
];

const TRANSPORTER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/portal", label: "Transporter Portal", icon: Truck }],
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
  allowedResources = [],
}: {
  children: ReactNode;
  branding?: AppBranding;
  userRole?: string | null;
  userName?: string | null;
  allowedResources?: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isTransporter = userRole === "transporter_user";
  const isSuperAdmin = userRole === "super_admin";
  const roleLabel = ROLE_LABELS[userRole || ""] || "User";
  const allowed = new Set(allowedResources);

  const navGroups = isTransporter
    ? TRANSPORTER_NAV_GROUPS
    : NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!userRole) return false;
            if (isSuperAdmin) return true;
            if (item.superAdminOnly) return false;
            if (!item.resource) return true;
            return allowed.has(item.resource);
          }),
        }))
        .filter((group) => group.items.length > 0);

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

  const workspaceLabel = isTransporter
    ? "Transporter Portal"
    : isSuperAdmin
      ? "Super Administrator"
      : roleLabel;

  const sessionLabel = userName || workspaceLabel;

  return (
    <div data-app-shell className="app-shell min-h-screen lg:flex">
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-white/10 bg-[#0b1525] text-slate-100 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.companyName}
                className="h-10 w-10 rounded-xl bg-white object-contain p-1.5 shadow-sm"
              />
            ) : (
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${branding.themeColor}, ${branding.accentColor || "#026b02"})` }}
              >
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-white">{branding.companyName}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{branding.tagline}</p>
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
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-white text-slate-950"
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

        <div className="border-t border-white/10 p-3">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sign out
            </button>
          </form>
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
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {activeContext?.group || (isTransporter ? "Workspace" : "VIMS")}
              </p>
              <p className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-950">
                {activeContext?.item.label || workspaceLabel}
              </p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {sessionLabel}
              </div>
            </div>
          </div>
        </header>

        <main className="app-shell-content min-h-[calc(100vh-65px)] overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
