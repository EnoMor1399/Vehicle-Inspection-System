"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType, type KeyboardEvent } from "react";
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
  UsersRound,
} from "lucide-react";

type WorkspaceLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
};

type WorkspaceGroup = {
  label: string;
  items: WorkspaceLink[];
};

const PRIMARY_WORKSPACES: WorkspaceLink[] = [
  { href: "/driver-training", label: "Overview", icon: GraduationCap },
  { href: "/driver-training/requests", label: "Requests", icon: ClipboardPlus },
  { href: "/driver-training/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/driver-training/participants", label: "Participants", icon: UsersRound },
  { href: "/driver-training/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/driver-training/certificates", label: "Certificates", icon: Award },
  { href: "/driver-training/analytics", label: "Analytics", icon: BarChart3 },
];

const SECONDARY_GROUPS: WorkspaceGroup[] = [
  {
    label: "Programme management",
    items: [
      { href: "/driver-training/commercials", label: "Commercials", icon: BadgeDollarSign, description: "Pricing, quotations and commercial controls" },
      { href: "/driver-training/development", label: "Development", icon: Target, description: "Programme development and improvement" },
      { href: "/driver-training/curriculum", label: "Curriculum", icon: BookOpenCheck, description: "Course structure and learning content" },
      { href: "/driver-training/instructors", label: "Instructors", icon: BadgeCheck, description: "Instructor records and competence" },
      { href: "/driver-training/logistics", label: "Logistics", icon: Boxes, description: "Training resources and delivery logistics" },
      { href: "/driver-training/communications", label: "Communications", icon: BellRing, description: "Participant and programme communications" },
    ],
  },
  {
    label: "Safety & assurance",
    items: [
      { href: "/driver-training/safety", label: "Safety", icon: HardHat, description: "Safety controls and incident prevention" },
      { href: "/driver-training/accreditation", label: "Accreditation", icon: Landmark, description: "Accreditation and external recognition" },
      { href: "/driver-training/readiness", label: "Readiness", icon: ClipboardCheck, description: "Pre-delivery readiness checks" },
      { href: "/driver-training/evidence", label: "Evidence", icon: FileCheck2, description: "Assessment and programme evidence" },
      { href: "/driver-training/quality", label: "Quality", icon: ShieldCheck, description: "Quality assurance and review" },
      { href: "/driver-training/compliance", label: "Compliance", icon: ClipboardList, description: "Compliance obligations and controls" },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/driver-training") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DriverTrainingNav() {
  const pathname = usePathname();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const secondaryActive = SECONDARY_GROUPS.some((group) =>
    group.items.some((item) => isActivePath(pathname, item.href))
  );

  useEffect(() => {
    moreRef.current?.removeAttribute("open");
  }, [pathname]);

  const closeMore = () => {
    moreRef.current?.removeAttribute("open");
  };

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !moreRef.current?.open) return;
    event.preventDefault();
    closeMore();
    moreRef.current.querySelector<HTMLElement>("summary")?.focus();
  };

  return (
    <div className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] py-2.5">
        <nav aria-label="Driver Training & Assessment" className="flex items-start gap-1.5">
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {PRIMARY_WORKSPACES.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 ${
                    active
                      ? "bg-[var(--brand-color)] text-white shadow-sm"
                      : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>

          <details ref={moreRef} onKeyDown={handleMoreKeyDown} className="group relative shrink-0">
            <summary
              aria-label="More Driver Training workspaces"
              className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden ${
                secondaryActive
                  ? "bg-[var(--vims-panel-soft)] text-[var(--brand-color)] ring-1 ring-inset ring-[var(--vims-line-strong)]"
                  : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]"
              }`}
            >
              More
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>

            <div className="absolute right-0 z-40 mt-2 max-h-[min(72vh,38rem)] w-[min(92vw,44rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-2 shadow-2xl">
              <div className="grid gap-2 md:grid-cols-2">
                {SECONDARY_GROUPS.map((group) => (
                  <div key={group.label} className="rounded-xl bg-[var(--vims-panel-soft)] p-2">
                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--vims-ink-muted)]">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map(({ href, label, description, icon: Icon }) => {
                        const active = isActivePath(pathname, href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={closeMore}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-inset ${
                              active
                                ? "bg-[var(--vims-panel-solid)] text-[var(--brand-color)] shadow-sm ring-1 ring-inset ring-[var(--vims-line)]"
                                : "text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-solid)] hover:text-[var(--vims-ink)]"
                            }`}
                          >
                            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--vims-panel-solid)] ring-1 ring-inset ring-[var(--vims-line)]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{label}</span>
                              {description && (
                                <span className="mt-0.5 block text-xs leading-4 text-[var(--vims-ink-muted)]">
                                  {description}
                                </span>
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </nav>
      </div>
    </div>
  );
}
