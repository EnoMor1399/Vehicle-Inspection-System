import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, ClipboardCheck,
  FileText, ShieldCheck,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { SCOPED_SECTION_DETAILS, type ScopedSection } from "@/lib/platform-oversight-navigation";
import { SCOPED_MODULE_PAGE_SIZE } from "@/lib/platform-scoped-module-records";

export interface ScopedClassicRecord {
  id: string;
  name: string;
  reference: string;
  type: string;
  status: string;
  detail: string;
  date: string;
}
export type ScopedClassicPageData = {
  records: ScopedClassicRecord[];
  total: number;
  page: number;
  totalPages: number;
};

function pageUrl(id: string, section: string, page: number) {
  const base = `/platform/oversight/${encodeURIComponent(id)}/section/${section}`;
  return page > 1 ? `${base}?page=${page}` : base;
}

// Uses the same PageHeader, StatCard, Card, Badge, and native register
// styling as regular VIMS modules. It is an intentionally read-only
// presentation for modules that cannot safely expose operational forms.
export function ClassicScopedModuleView({
  organizationId,
  section,
  rows,
  organizationName,
}: {
  organizationId: string;
  section: ScopedSection;
  rows: ScopedClassicPageData;
  organizationName: string;
}) {
  const config = SCOPED_SECTION_DETAILS[section];
  const active = rows.records.filter(r =>
    ["active", "passed", "completed", "approved", "resolved", "confirmed"].includes(r.status.toLowerCase())).length;
  const attention = rows.records.filter(r =>
    /failed|high|critical|pending|open|overdue|reinspection|suspended/i.test(r.status)).length;
  const name = section === "maintenance-risk" ? "Maintenance Risk"
    : section === "compliance" ? "Compliance Centre"
    : config.title;
  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        eyebrow="Vehicle Inspection"
        title={name}
        description={config.description}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Registered records"
          value={rows.total}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Positive status"
          value={active}
          hint="On the current page"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Needs attention"
          value={attention}
          hint="On the current page"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-950">{name} register</h2>
            <p className="mt-1 text-xs text-slate-500">
              {organizationName} · view-only company records · {rows.total.toLocaleString()} total
            </p>
          </div>
          <Badge tone="slate"><Activity className="h-3.5 w-3.5" /> Read-only</Badge>
        </div>
        {rows.records.length === 0 ? (
          <div className="p-7">
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No records to display"
              description="No records were found for the selected organization in this module."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.records.map((record) => (
                  <tr key={record.id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{record.reference}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{record.name}</td>
                    <td className="px-4 py-3 text-slate-600">{record.type}</td>
                    <td className="px-4 py-3">
                      <Badge tone={/active|passed|completed|approved|resolved/i.test(record.status)
                        ? "emerald" : /failed|critical|suspended/i.test(record.status) ? "red" : "slate"}>
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.detail}</td>
                    <td className="px-4 py-3 text-slate-500">{record.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs text-slate-600">
          {rows.page > 1 ? (
            <Link href={pageUrl(organizationId, section, rows.page - 1)}
              className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <ArrowLeft className="h-4 w-4" /> Previous
            </Link>
          ) : <span />}
          <span>Page {rows.page} of {rows.totalPages}</span>
          {rows.page < rows.totalPages ? (
            <Link href={pageUrl(organizationId, section, rows.page + 1)}
              className="inline-flex items-center gap-1 font-semibold text-slate-700">
              Next <ArrowRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </div>
      </Card>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        These are scoped, read-only records for the selected company. Operational
        workflows remain available only within separately authorized organization accounts.
      </p>
    </div>
  );
}
