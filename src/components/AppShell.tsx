"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { scopedOrganizationHref, SCOPED_NAV_SECTIONS } from "@/lib/platform-oversight-navigation";
import { SuperAdminOperationControls } from "@/components/SuperAdminOperationControls";
import { canSeeTransporterPortalNavigation } from "@/lib/transporter-portal-access";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  Car,
  Check,
  ChevronRight,
  ChevronDown,
  CreditCard,
  ClipboardCheck,
  FileBarChart,
  FileText,
  GraduationCap,
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

const NO_SHELL_PATHS = ["/login", "/subscribe"];
const LAST_OVERSIGHT_ORG_KEY = "vims-superadmin-oversight-selection";
const OVERSIGHT_ORG_CHANGED_EVENT = "vims:oversight-organization-changed";

function subscribeToSelectedOrganization(notify: () => void) {
  window.addEventListener(OVERSIGHT_ORG_CHANGED_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(OVERSIGHT_ORG_CHANGED_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

function getSelectedOrganizationSnapshot() {
  try { return sessionStorage.getItem(LAST_OVERSIGHT_ORG_KEY) || ""; }
  catch { return ""; }
}
function getSelectedOrganizationServerSnapshot() { return ""; }


const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrator",
  organization_owner: "Organization Owner",
  vehicle_inspection_admin: "Vehicle Inspection Administrator",
  driver_training_admin: "Driver Training Administrator",
  admin: "Legacy Administrator",
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
  organizationOwnerOnly?: boolean;
  transporterPortalAdminOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Vehicle Inspection Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, resource: "vehicle_inspection" },
      { href: "/vehicles", label: "Vehicles", icon: Car, resource: "vehicles" },
      { href: "/transporters", label: "Transporters", icon: Truck, resource: "transporters" },
      { href: "/portal", label: "Transporter Portal", icon: Truck, transporterPortalAdminOnly: true },
      { href: "/inspections", label: "Inspections", icon: ClipboardCheck, resource: "inspections" },
      { href: "/daily-inspections", label: "Daily Pre-Trip", icon: CalendarCheck, resource: "inspections" },
      { href: "/schedule", label: "Inspection Scheduling", icon: CalendarClock, resource: "inspections" },
      { href: "/locations", label: "Stations", icon: MapPin, resource: "locations" },
    ],
  },
  {
    label: "Driver Training & Assessment",
    items: [
      { href: "/driver-training", label: "Driver Training & Assessment", icon: GraduationCap, resource: "training" },
    ],
  },
  {
    label: "Vehicle Inspection Intelligence",
    collapsible: true,
    items: [
      { href: "/reports", label: "Reports & Analytics", icon: FileBarChart, resource: "reports" },
      { href: "/compliance", label: "Compliance Centre", icon: ShieldCheck, resource: "reports" },
      { href: "/predictive", label: "Maintenance Risk", icon: Activity, resource: "reports" },
      { href: "/powerbi", label: "Power BI", icon: BarChart3, resource: "reports" },
      { href: "/rfid", label: "RFID Operations", icon: Radio, resource: "vehicles" },
    ],
  },
  {
    label: "Vehicle Inspection Administration",
    collapsible: true,
    items: [
      { href: "/users", label: "Vehicle Inspection Users", icon: Users, resource: "users" },
      { href: "/documents", label: "Documents", icon: FileText, resource: "documents" },
      { href: "/import", label: "Import / Export", icon: Upload, resource: "import" },
      { href: "/settings", label: "Settings", icon: SettingsIcon, resource: "settings" },
      { href: "/audit", label: "Audit Log", icon: ScrollText, resource: "audit" },
    ],
  },
  {
    label: "Platform Administration",
    items: [
      { href: "/platform/organizations", label: "Subscriber Companies", icon: Building2, superAdminOnly: true },
      { href: "/platform/account-support", label: "Account Support", icon: ShieldCheck, superAdminOnly: true },
      { href: "/platform/content", label: "Content Management Centre", icon: BookOpen, superAdminOnly: true },
      { href: "/platform/notices", label: "System Change Notices", icon: Bell, superAdminOnly: true },
      { href: "/platform/payments", label: "Subscription Payments", icon: CreditCard, superAdminOnly: true },
    ],
  },
  {
    label: "Access & Support",
    collapsible: true,
    items: [
      { href: "/organization/account", label: "Organization Account", icon: Building2, organizationOwnerOnly: true },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/apps", label: "App Access", icon: Smartphone },
      { href: "/api-docs", label: "API & Integrations", icon: FileBarChart, resource: "api_module" },
      { href: "/guide", label: "User Guide", icon: BookOpen },
    ],
  },
];

const TRANSPORTER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/portal", label: "Transporter Portal", icon: Truck }, { href: "/notifications", label: "Notifications", icon: Bell }],
  },
];

type OrganizationChoice = { id: string; name: string; slug: string; status: string };

export interface AppBranding {
  logoUrl?: string | null;
  companyName: string;
  tagline: string;
  footerText: string;
  themeColor: string;
  accentColor?: string;
}

const DEFAULT_BRANDING: AppBranding = {
  companyName: "VIMS Enterprise",
  tagline: "Multi-Organization Vehicle Inspection Management",
  footerText: "© 2026 VIMS Enterprise · Secure Multi-Organization Platform",
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
  appearanceControl,
  supportContext,
  changeNoticeBanner,
  notificationUnreadCount = 0,
  organizationChoices = [],
  operationContext,
  operationExpired = false,
}: {
  children: ReactNode;
  branding?: AppBranding;
  userRole?: string | null;
  userName?: string | null;
  allowedResources?: string[];
  appearanceControl?: ReactNode;
  supportContext?: { actorName: string; targetName: string; targetEmail: string; expiresAt: string } | null;
  changeNoticeBanner?: { title: string; severity: "critical" | "important"; effectiveAt: string } | null;
  notificationUnreadCount?: number;
  organizationChoices?: OrganizationChoice[];
  operationContext?: { organizationId: string; organizationName: string; expiresAt: string; stepUpExpiresAt: string | null } | null;
  operationExpired?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizationMenuOpen, setOrganizationMenuOpen] = useState(false);
  const rememberedOrganizationId = useSyncExternalStore(
    subscribeToSelectedOrganization,
    getSelectedOrganizationSnapshot,
    getSelectedOrganizationServerSnapshot,
  );
  const organizationMenuRef = useRef<HTMLDivElement>(null);
  const isTransporter = userRole === "transporter_user";
  const isSuperAdmin = userRole === "super_admin";
  const canSelectOrganization = isSuperAdmin && !supportContext;
  const roleLabel = ROLE_LABELS[userRole || ""] || "User";
  const allowed = new Set(allowedResources);

  // A selected organization is a navigation preference only, not a
  // change to the authenticated tenant, session, role, or data permissions.
  const routeParts = pathname.split("/");
  const pathOrganizationId =
    routeParts[1] === "platform" && routeParts[2] === "oversight"
    && ((routeParts.length === 4 && routeParts[3])
      || (routeParts.length === 6 && routeParts[4] === "section" && routeParts[5]))
      ? routeParts[3] : "";
  const validOrganizationId = (id: string) =>
    organizationChoices.some((organization) => organization.id === id);
  const activeOversightOrganizationId = canSelectOrganization
    ? (operationContext?.organizationId
      || (validOrganizationId(pathOrganizationId)
        ? pathOrganizationId
        : validOrganizationId(rememberedOrganizationId) ? rememberedOrganizationId : ""))
    : "";
  // The platform-control-plane organization list is intentionally unavailable
  // during elevated company operations. Use the validated server-side operation
  // identity for the visible organization label instead of falling back to the
  // original login organization's branding.
  const activeOversightOrganization = operationContext
    ? { id: operationContext.organizationId, name: operationContext.organizationName,
        slug: "", status: "active" }
    : organizationChoices.find((organization) => organization.id === activeOversightOrganizationId);
  const currentPageIsScoped = Boolean(pathOrganizationId && pathOrganizationId === activeOversightOrganizationId);

  function scopedNavigationHref(href: string) {
    if (!canSelectOrganization) return href;
    if (operationContext) return href;
    if (activeOversightOrganizationId) return scopedOrganizationHref(activeOversightOrganizationId, href);
    // A Super Admin with no selection must not accidentally open the
    // operational pages belonging to their original login organization.
    if (href === "/" || href in SCOPED_NAV_SECTIONS) return "/platform/oversight";
    return href;
  }

  function isActiveNavItem(item: NavItem) {
    const href = scopedNavigationHref(item.href);
    if (item.href === "/" && canSelectOrganization && activeOversightOrganizationId) {
      return pathname === href;
    }
    return isActivePath(pathname, href);
  }

  const navGroups = isTransporter
    ? TRANSPORTER_NAV_GROUPS
    : NAV_GROUPS
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!userRole) return false;
            if (item.transporterPortalAdminOnly) {
              return canSeeTransporterPortalNavigation(userRole, allowedResources);
            }
            if (isSuperAdmin) return !operationContext || !item.superAdminOnly;
            if (item.superAdminOnly) return false;
            if (item.organizationOwnerOnly && userRole !== "organization_owner") return false;
            if (!item.resource) return true;
            return allowed.has(item.resource);
          }),
        }))
        .filter((group) => group.items.length > 0);

  const activeContext = (() => {
    for (const group of navGroups) {
      const item = group.items.find((candidate) => isActiveNavItem(candidate));
      if (item) return { group: group.label, item };
    }
    return null;
  })();

  const workspaceLabel = isTransporter
    ? "Transporter Portal"
    : isSuperAdmin
      ? "Super Administrator"
      : roleLabel;

  const sessionLabel = userName || workspaceLabel;

  useEffect(() => {
    if (!canSelectOrganization) return;
    try {
      const isAllowed = (id: string) => organizationChoices.some((org) => org.id === id);
      const current = getSelectedOrganizationSnapshot();
      if (isAllowed(pathOrganizationId) && current !== pathOrganizationId) {
        sessionStorage.setItem(LAST_OVERSIGHT_ORG_KEY, pathOrganizationId);
        window.dispatchEvent(new Event(OVERSIGHT_ORG_CHANGED_EVENT));
      } else if (current && !isAllowed(current)) {
        sessionStorage.removeItem(LAST_OVERSIGHT_ORG_KEY);
        window.dispatchEvent(new Event(OVERSIGHT_ORG_CHANGED_EVENT));
      }
    } catch {
      // Storage is an optional navigation hint, never permission to access data.
    }
  }, [canSelectOrganization, pathOrganizationId, organizationChoices]);

  useEffect(() => {
    if (!organizationMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!organizationMenuRef.current?.contains(event.target as Node)) {
        setOrganizationMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOrganizationMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [organizationMenuOpen]);

  function selectOversightOrganization(organizationId: string) {
    if (!canSelectOrganization || operationContext) return;
    if (!organizationChoices.some((organization) => organization.id === organizationId)) return;
    setOrganizationMenuOpen(false);
    try {
      sessionStorage.setItem(LAST_OVERSIGHT_ORG_KEY, organizationId);
      window.dispatchEvent(new Event(OVERSIGHT_ORG_CHANGED_EVENT));
    } catch {}
    setOpen(false);
    router.push(`/platform/oversight/${encodeURIComponent(organizationId)}`);
  }

  if (
    NO_SHELL_PATHS.includes(pathname)
    || pathname.startsWith("/invite/")
    || pathname.startsWith("/verify")
    || pathname.startsWith("/certificate")
  ) {
    return <>{children}{appearanceControl}</>;
  }

  return (
    <div data-app-shell className="app-shell min-h-screen lg:flex">
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[16rem] flex-col border-r border-white/10 bg-[#0b1525] text-slate-100 shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-3 py-3">
          <div className="flex items-center gap-2">
            {canSelectOrganization ? (
              <div className="relative min-w-0 flex-1" ref={organizationMenuRef}>
                <button
                  type="button"
                  aria-label="Switch organization in the sidebar"
                  aria-expanded={organizationMenuOpen}
                  aria-controls="sidebar-organization-options"
                  onClick={() => { if (!operationContext) setOrganizationMenuOpen((value) => !value); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  {activeOversightOrganization || !branding.logoUrl ? (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-emerald-300">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={branding.logoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1.5 shadow-sm"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold tracking-tight text-white">
                      {activeOversightOrganization?.name ?? branding.companyName}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {operationContext ? "Authorized operations · " + activeOversightOrganization?.status
                        : activeOversightOrganization
                          ? "Company oversight · " + activeOversightOrganization.status
                          : "Select organization to manage"}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${organizationMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {organizationMenuOpen && (
                  <div
                    id="sidebar-organization-options"
                    role="group"
                    aria-label="Organisations available for read-only oversight"
                    className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-[#14243a] p-1.5 shadow-2xl"
                  >
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Switch organisation · oversight only
                    </p>
                    <div className="max-h-64 overflow-y-auto">
                      {organizationChoices.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-300">No organisations available.</p>
                      ) : (
                        organizationChoices.map((organization) => (
                          <button
                            key={organization.id}
                            type="button"
                            onClick={() => selectOversightOrganization(organization.id)}
                            aria-current={activeOversightOrganizationId === organization.id ? "true" : undefined}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                              activeOversightOrganizationId === organization.id ? "bg-white/10 text-emerald-200" : "text-slate-100"
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{organization.name}</span>
                              <span className="block truncate text-[11px] text-slate-400">{organization.status}</span>
                            </span>
                            {activeOversightOrganizationId === organization.id && (
                              <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                    <p className="border-t border-white/10 px-3 py-2 text-[10px] leading-4 text-slate-400">
                      Selecting a company opens its scoped oversight page, not an operational session.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3 px-1">
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
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{branding.tagline}</p>
                </div>
              </div>
            )}
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

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary sections">
          {navGroups.map((group) => {
            const groupHasCurrentPage = group.items.some((item) => isActiveNavItem(item));
            const items = (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActiveNavItem(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={scopedNavigationHref(item.href)}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-white/12 text-white ring-1 ring-white/10"
                          : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-emerald-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </Link>
                  );
                })}
              </div>
            );

            return group.collapsible ? (
              <details key={`${group.label}:${pathname}`} open={groupHasCurrentPage} className="group/section mb-2 rounded-lg">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.07em] text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 [&::-webkit-details-marker]:hidden">
                  <span>{group.label}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/section:rotate-180" />
                </summary>
                <div className="mt-1 pl-1">{items}</div>
              </details>
            ) : (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
                {items}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <form action={supportContext ? "/api/support-session/end" : "/api/auth/logout"} method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
            >
              <LogOut className="h-[18px] w-[18px]" />
              {supportContext ? "Exit support view" : "Sign out"}
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
                {supportContext && (
          <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
            <span><strong>Read-only support view:</strong> {supportContext.actorName} viewing as {supportContext.targetName} ({supportContext.targetEmail}). Expires {new Date(supportContext.expiresAt).toLocaleTimeString()}.</span>
            <form action="/api/support-session/end" method="POST"><button className="rounded-lg bg-amber-950 px-4 py-2 font-semibold text-white" type="submit">Exit support view</button></form>
          </div>
        )}
{changeNoticeBanner && userRole && (
          <div role="status" className={`border-b px-4 py-3 text-sm ${changeNoticeBanner.severity === "critical" ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            <strong>{changeNoticeBanner.severity === "critical" ? "Critical system update" : "Important update"}:</strong>{" "}
            {changeNoticeBanner.title} · Effective {new Date(changeNoticeBanner.effectiveAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC.{" "}
            <Link href="/notifications" className="font-semibold underline">Read impact and required actions</Link>
          </div>
        )}
<header className={supportContext ? "sticky top-[60px] z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8" : "sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8"}>
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


            <div className="flex items-center gap-2 sm:gap-3">
              {userRole && (
                <Link
                  href={scopedNavigationHref("/notifications")}
                  title={activeOversightOrganizationId ? "Selected organization security alerts" : "Notifications and system updates"}
                  aria-label={activeOversightOrganizationId
                    ? "Open selected organization security alerts"
                    : notificationUnreadCount > 0
                      ? `Open notifications (${notificationUnreadCount} unread)`
                      : "Open notifications"}
                  className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {!activeOversightOrganizationId && notificationUnreadCount > 0 && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-[1.2rem] rounded-full bg-red-600 px-1 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                      {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
                    </span>
                  )}
                </Link>
              )}
              {isSuperAdmin && !operationContext && (
                <Link href="/platform/notices" className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 xl:inline-flex">
                  Manage notices
                </Link>
              )}
              {appearanceControl}
              <div className="hidden items-center gap-3 md:flex">
                <div className="h-8 w-px bg-slate-200" />
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {sessionLabel}
                </div>
              </div>
            </div>
          </div>
        </header>

        {!operationContext && activeOversightOrganization && (
          <div role="status" className="flex flex-wrap items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-950 sm:px-6 lg:px-8">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span><strong>{activeOversightOrganization.name}</strong> · {currentPageIsScoped ? "Organization-scoped view" : "Organization selection retained · this page is platform-wide"}</span>
            <Link href={`/platform/oversight/${encodeURIComponent(activeOversightOrganization.id)}`} className="font-semibold underline">Overview</Link>
          </div>
        )}
        {isSuperAdmin && (
          <SuperAdminOperationControls
            selectedOrganization={activeOversightOrganization}
            operations={operationContext}
            expired={operationExpired}
          />
        )}
        {!isSuperAdmin && operationExpired && (
          <SuperAdminOperationControls expired />
        )}
        <main className="app-shell-content min-h-[calc(100vh-65px)] overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
