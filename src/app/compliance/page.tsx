import type { ReactNode } from "react";
import Link from "next/link";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { db } from "@/db";
import { documents, inspections, transporters, vehicles } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/require-auth";
import { classifyExpiry, earliestExpiry, type ComplianceExpiry } from "@/lib/compliance";

export const dynamic = "force-dynamic";

const RISK_RESULTS = ["fail", "reinspection_required", "conditional_pass"] as const;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

function riskTone(status: ComplianceExpiry["state"]): "red" | "amber" | "emerald" | "slate" {
  if (status === "overdue") return "red";
  if (status === "due_soon") return "amber";
  if (status === "current") return "emerald";
  return "slate";
}

function resultTone(result: string): "red" | "amber" | "slate" {
  if (result === "fail") return "red";
  if (result === "reinspection_required" || result === "conditional_pass") return "amber";
  return "slate";
}

function resultLabel(result: string) {
  if (result === "reinspection_required") return "Re-inspection";
  if (result === "conditional_pass") return "Conditional";
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export default async function CompliancePage() {
  const user = await requirePermission("reports");

  const now = new Date();
  const horizon = dateOnly(addDays(now, 60));
  const vehicleRiskWhere = and(
    eq(vehicles.organizationId, user.organizationId),
    or(
    sql`${vehicles.insuranceExpiry} is not null and ${vehicles.insuranceExpiry} <= ${horizon}`,
    sql`${vehicles.roadworthyExpiry} is not null and ${vehicles.roadworthyExpiry} <= ${horizon}`,
    sql`${vehicles.roadFundExpiry} is not null and ${vehicles.roadFundExpiry} <= ${horizon}`,
    ),
  );
  const transporterRiskWhere = and(
    eq(transporters.organizationId, user.organizationId),
    isNull(transporters.deletedAt),
    or(
      sql`${transporters.insuranceExpiry} is not null and ${transporters.insuranceExpiry} <= ${horizon}`,
      sql`${transporters.permitExpiry} is not null and ${transporters.permitExpiry} <= ${horizon}`,
    ),
  );
  const documentRiskWhere = and(
    eq(documents.organizationId, user.organizationId),
    sql`${documents.expiryDate} is not null and ${documents.expiryDate} <= ${horizon}`,
  );
  const inspectionRiskWhere = and(
    eq(inspections.organizationId, user.organizationId),
    isNull(inspections.archivedAt),
    inArray(inspections.overallResult, [...RISK_RESULTS]),
  );

  const [
    vehicleRows,
    transporterRows,
    documentRows,
    inspectionRows,
    vehicleCountRows,
    transporterCountRows,
    documentCountRows,
    inspectionCountRows,
  ] = await Promise.all([
    db
      .select({
        id: vehicles.id,
        registrationNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
        insuranceExpiry: vehicles.insuranceExpiry,
        roadworthyExpiry: vehicles.roadworthyExpiry,
        roadFundExpiry: vehicles.roadFundExpiry,
      })
      .from(vehicles)
      .where(vehicleRiskWhere)
      .limit(24),
    db
      .select({
        id: transporters.id,
        companyName: transporters.companyName,
        insuranceExpiry: transporters.insuranceExpiry,
        permitExpiry: transporters.permitExpiry,
      })
      .from(transporters)
      .where(transporterRiskWhere)
      .limit(24),
    db
      .select({
        id: documents.id,
        name: documents.name,
        ownerType: documents.ownerType,
        type: documents.type,
        expiryDate: documents.expiryDate,
      })
      .from(documents)
      .where(documentRiskWhere)
      .orderBy(documents.expiryDate)
      .limit(24),
    db
      .select({
        id: inspections.id,
        inspectionNumber: inspections.inspectionNumber,
        result: inspections.overallResult,
        inspectionDate: inspections.inspectionDate,
        reinspectionDate: inspections.reinspectionDate,
        registrationNumber: vehicles.registrationNumber,
      })
      .from(inspections)
      .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .where(inspectionRiskWhere)
      .orderBy(desc(inspections.inspectionDate))
      .limit(24),
    db.select({ count: sql<number>`count(*)::int` }).from(vehicles).where(vehicleRiskWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(transporters).where(transporterRiskWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(documents).where(documentRiskWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(inspections).where(inspectionRiskWhere),
  ]);

  const vehicleRiskCount = Number(vehicleCountRows[0]?.count || 0);
  const transporterRiskCount = Number(transporterCountRows[0]?.count || 0);
  const documentRiskCount = Number(documentCountRows[0]?.count || 0);
  const inspectionRiskCount = Number(inspectionCountRows[0]?.count || 0);
  const totalOpenRisk = vehicleRiskCount + transporterRiskCount + documentRiskCount + inspectionRiskCount;

  const vehicleQueue = vehicleRows
    .map((row) => ({
      ...row,
      risk: earliestExpiry([
        { label: "Insurance", value: row.insuranceExpiry },
        { label: "Roadworthy", value: row.roadworthyExpiry },
        { label: "Road Fund", value: row.roadFundExpiry },
      ], now),
    }))
    .filter((row) => row.risk)
    .sort((a, b) => (a.risk?.status.days ?? 99999) - (b.risk?.status.days ?? 99999));

  const transporterQueue = transporterRows
    .map((row) => ({
      ...row,
      risk: earliestExpiry([
        { label: "Insurance", value: row.insuranceExpiry },
        { label: "Business Permit", value: row.permitExpiry },
      ], now),
    }))
    .filter((row) => row.risk)
    .sort((a, b) => (a.risk?.status.days ?? 99999) - (b.risk?.status.days ?? 99999));

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        title="Compliance Centre"
        description="One command layer for vehicle expiries, transporter obligations, document validity and inspection outcomes that require action."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone="violet"><ShieldCheck className="h-3.5 w-3.5" /> Enterprise expansion</Badge>
            <Badge tone={totalOpenRisk > 0 ? "amber" : "emerald"}>
              {totalOpenRisk > 0 ? `${totalOpenRisk} open risk items` : "No open compliance risks"}
            </Badge>
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Vehicle obligations"
          value={vehicleRiskCount}
          hint="Due or overdue within 60 days"
          tone={vehicleRiskCount ? "amber" : "emerald"}
          icon={<Car className="h-5 w-5" />}
        />
        <StatCard
          label="Transporter obligations"
          value={transporterRiskCount}
          hint="Insurance and permits"
          tone={transporterRiskCount ? "amber" : "emerald"}
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          label="Document expiries"
          value={documentRiskCount}
          hint="Controlled registry"
          tone={documentRiskCount ? "red" : "emerald"}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="Inspection risk queue"
          value={inspectionRiskCount}
          hint="Fail, conditional or re-inspection"
          tone={inspectionRiskCount ? "red" : "emerald"}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <RiskPanel
          title="Vehicle lifecycle obligations"
          description="Nearest recorded vehicle expiry requiring attention."
          href="/vehicles"
          empty="No vehicle insurance, roadworthy or road-fund obligations fall within the next 60 days."
        >
          {vehicleQueue.map((row) => row.risk ? (
            <RiskRow
              key={row.id}
              title={row.registrationNumber}
              subtitle={[row.make, row.model].filter(Boolean).join(" ")}
              obligation={row.risk.label}
              date={String(row.risk.value)}
              status={row.risk.status}
            />
          ) : null)}
        </RiskPanel>

        <RiskPanel
          title="Transporter compliance"
          description="Insurance and business-permit obligations across active transporters."
          href="/transporters"
          empty="No transporter insurance or permit obligations fall within the next 60 days."
        >
          {transporterQueue.map((row) => row.risk ? (
            <RiskRow
              key={row.id}
              title={row.companyName}
              subtitle="Transporter"
              obligation={row.risk.label}
              date={String(row.risk.value)}
              status={row.risk.status}
            />
          ) : null)}
        </RiskPanel>

        <RiskPanel
          title="Controlled document expiry"
          description="Registered documents that are already expired or approaching expiry."
          href="/documents"
          empty="No registered document expiries fall within the next 60 days."
        >
          {documentRows.map((row) => {
            const status = classifyExpiry(row.expiryDate, 60, now);
            return (
              <RiskRow
                key={row.id}
                title={row.name}
                subtitle={`${row.ownerType} · ${row.type}`}
                obligation="Document expiry"
                date={row.expiryDate || "Not recorded"}
                status={status}
              />
            );
          })}
        </RiskPanel>

        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-[var(--vims-ink)]">Inspection outcome queue</h2>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">
                Recent failed, conditional and re-inspection outcomes.
              </p>
            </div>
            <Link href="/inspections" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-accent)] hover:opacity-80">
              Open inspections <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {inspectionRows.length === 0 ? (
            <div className="p-5 sm:p-6">
              <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No inspection outcome risk" description="No active fail, conditional or re-inspection outcomes were found." />
            </div>
          ) : (
            <div className="divide-y divide-[var(--vims-line)]">
              {inspectionRows.map((row) => (
                <Link
                  key={row.id}
                  href={`/inspections/${row.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--vims-panel-soft)] sm:px-6"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--vims-ink)]">{row.registrationNumber}</p>
                    <p className="mt-0.5 text-xs text-[var(--vims-ink-muted)]">{row.inspectionNumber} · {new Date(row.inspectionDate).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={resultTone(row.result)}>{resultLabel(row.result)}</Badge>
                    {row.reinspectionDate && <p className="mt-1 text-[11px] text-[var(--vims-ink-muted)]">Re-check {row.reinspectionDate}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function RiskPanel({
  title,
  description,
  href,
  empty,
  children,
}: {
  title: string;
  description: string;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold text-[var(--vims-ink)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">{description}</p>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-accent)] hover:opacity-80">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="p-5 sm:p-6">
          <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="Nothing requires attention" description={empty} />
        </div>
      ) : (
        <div className="divide-y divide-[var(--vims-line)]">{items}</div>
      )}
    </Card>
  );
}

function RiskRow({
  title,
  subtitle,
  obligation,
  date,
  status,
}: {
  title: string;
  subtitle: string;
  obligation: string;
  date: string;
  status: ComplianceExpiry;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--vims-ink)]">{title}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--vims-ink-muted)]">{subtitle} · {obligation}</p>
      </div>
      <div className="text-right">
        <Badge tone={riskTone(status.state)}>{status.label}</Badge>
        <p className="mt-1 text-[11px] text-[var(--vims-ink-muted)]">{date}</p>
      </div>
    </div>
  );
}
