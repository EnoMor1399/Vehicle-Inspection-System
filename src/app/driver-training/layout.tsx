import Link from "next/link";
import type { ReactNode } from "react";
import { Award, BadgeCheck, BarChart3, CalendarDays, ClipboardCheck, ClipboardList, FileCheck2, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";

const WORKSPACES = [
  { href: "/driver-training", label: "Overview", icon: GraduationCap },
  { href: "/driver-training/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/driver-training/participants", label: "Participants", icon: UsersRound },
  { href: "/driver-training/instructors", label: "Instructors", icon: BadgeCheck },
  { href: "/driver-training/readiness", label: "Readiness", icon: ClipboardCheck },
  { href: "/driver-training/evidence", label: "Evidence", icon: FileCheck2 },
  { href: "/driver-training/quality", label: "Quality", icon: ShieldCheck },
  { href: "/driver-training/certificates", label: "Certificates", icon: Award },
  { href: "/driver-training/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/driver-training/compliance", label: "Compliance", icon: ClipboardList },
] as const;

export default function DriverTrainingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-4 sm:px-6 lg:px-8">
        <nav aria-label="Driver Training workspaces" className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto py-2">
          {WORKSPACES.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--vims-ink-soft)] transition hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)] sm:text-sm"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
