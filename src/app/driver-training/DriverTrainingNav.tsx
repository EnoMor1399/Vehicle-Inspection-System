"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType, type KeyboardEvent, type RefObject } from "react";
import {
  Award,
  BadgeCheck,
  BadgeDollarSign,
  BarChart3,
  BellRing,
  BookOpenCheck,
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileCheck2,
  GraduationCap,
  HardHat,
  Landmark,
  ShieldCheck,
  Target,
  UserCheck,
  UsersRound,
} from "lucide-react";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type WorkspaceGroup = {
  label: string;
  items: WorkspaceLink[];
};

const OPERATIONS: WorkspaceLink[] = [
  { href: "/driver-training/requests", label: "Requests", icon: ClipboardPlus },
  { href: "/driver-training/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/driver-training/participants", label: "Participants", icon: UsersRound },
];

const ASSESSMENT: WorkspaceLink[] = [
  { href: "/driver-training/assessments", label: "Assessment workspace", icon: ClipboardCheck },
  { href: "/driver-training/assessments/written-exams", label: "Written Exams", icon: BookOpenCheck },
  { href: "/driver-training/assessments/review", label: "Review queue", icon: UserCheck },
  { href: "/driver-training/certificates", label: "Certificates", icon: Award },
];

const MORE_GROUPS: WorkspaceGroup[] = [
  {
    label: "Programme setup",
    items: [
      { href: "/driver-training/commercials", label: "Commercials", icon: BadgeDollarSign },
      { href: "/driver-training/development", label: "Development", icon: Target },
      { href: "/driver-training/curriculum", label: "Curriculum", icon: BookOpenCheck },
      { href: "/driver-training/instructors", label: "Instructors", icon: BadgeCheck },
      { href: "/driver-training/logistics", label: "Logistics", icon: Boxes },
      { href: "/driver-training/communications", label: "Communications", icon: BellRing },
      { href: "/driver-training/users", label: "Training users", icon: UsersRound },
    ],
  },
  {
    label: "Safety & assurance",
    items: [
      { href: "/driver-training/safety", label: "Safety", icon: HardHat },
      { href: "/driver-training/accreditation", label: "Accreditation", icon: Landmark },
      { href: "/driver-training/readiness", label: "Readiness", icon: ClipboardCheck },
      { href: "/driver-training/evidence", label: "Evidence", icon: FileCheck2 },
      { href: "/driver-training/quality", label: "Quality", icon: ShieldCheck },
      { href: "/driver-training/compliance", label: "Compliance", icon: ClipboardList },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/driver-training") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuButton({ label, items, pathname, detailsRef }: { label: string; items: WorkspaceLink[]; pathname: string; detailsRef: RefObject<HTMLDetailsElement | null> }) {
  const active = items.some((item) => isActivePath(pathname, item.href));
  const close = () => detailsRef.current?.removeAttribute("open");
  const handleKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !detailsRef.current?.open) return;
    event.preventDefault(); close(); detailsRef.current?.querySelector<HTMLElement>("summary")?.focus();
  };
  return <details ref={detailsRef} onKeyDown={handleKeyDown} className="group relative shrink-0"><summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden ${active ? "bg-[var(--brand-color)] text-white shadow-sm" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}>{label}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-1.5 shadow-xl">{items.map(({ href, label: itemLabel, icon: Icon }) => { const itemActive = isActivePath(pathname, href); return <Link key={href} href={href} onClick={close} aria-current={itemActive ? "page" : undefined} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-inset ${itemActive ? "bg-[var(--vims-panel-soft)] text-[var(--brand-color)]" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}><Icon className="h-4 w-4 shrink-0" />{itemLabel}</Link>; })}</div></details>;
}

export default function DriverTrainingNav() {
  const pathname = usePathname();
  const operationsRef = useRef<HTMLDetailsElement>(null);
  const assessmentRef = useRef<HTMLDetailsElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => isActivePath(pathname, item.href)));
  useEffect(() => { operationsRef.current?.removeAttribute("open"); assessmentRef.current?.removeAttribute("open"); moreRef.current?.removeAttribute("open"); }, [pathname]);
  const closeMore = () => moreRef.current?.removeAttribute("open");
  const handleMoreKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => { if (event.key !== "Escape" || !moreRef.current?.open) return; event.preventDefault(); closeMore(); moreRef.current?.querySelector<HTMLElement>("summary")?.focus(); };
  return <div className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1600px] py-2.5"><nav aria-label="Driver Training & Assessment" className="flex min-w-0 items-start gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] sm:overflow-visible sm:pb-0"><Link href="/driver-training" aria-current={pathname === "/driver-training" ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 ${pathname === "/driver-training" ? "bg-[var(--brand-color)] text-white shadow-sm" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}><GraduationCap className="h-4 w-4" />Overview</Link><MenuButton label="Operations" items={OPERATIONS} pathname={pathname} detailsRef={operationsRef} /><MenuButton label="Assessments" items={ASSESSMENT} pathname={pathname} detailsRef={assessmentRef} /><Link href="/driver-training/analytics" aria-current={isActivePath(pathname, "/driver-training/analytics") ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 ${isActivePath(pathname, "/driver-training/analytics") ? "bg-[var(--brand-color)] text-white shadow-sm" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}><BarChart3 className="h-4 w-4" />Analytics</Link><details ref={moreRef} onKeyDown={handleMoreKeyDown} className="group relative shrink-0"><summary aria-label="Driver Training administration and assurance" className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden ${moreActive ? "bg-[var(--vims-panel-soft)] text-[var(--brand-color)] ring-1 ring-inset ring-[var(--vims-line-strong)]" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}>Admin & Assurance<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="absolute right-0 z-40 mt-2 w-[min(92vw,34rem)] rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-2 shadow-xl"><div className="grid gap-2 sm:grid-cols-2">{MORE_GROUPS.map((group) => <div key={group.label}><p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--vims-ink-muted)]">{group.label}</p>{group.items.map(({ href, label, icon: Icon }) => { const active = isActivePath(pathname, href); return <Link key={href} href={href} onClick={closeMore} aria-current={active ? "page" : undefined} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-inset ${active ? "bg-[var(--vims-panel-soft)] text-[var(--brand-color)]" : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"}`}><Icon className="h-4 w-4 shrink-0" />{label}</Link>; })}</div>)}</div></div></details></nav></div></div>;
}
