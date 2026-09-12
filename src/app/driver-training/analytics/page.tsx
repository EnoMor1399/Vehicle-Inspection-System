import Link from "next/link";
import { and, count, countDistinct, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { AlertTriangle, Award, BarChart3, CalendarClock, CheckCircle2, UsersRound } from "lucide-react";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canViewTraining } from "@/lib/training-access";
import { formatDate } from "@/lib/utils";
import { TrainingAnalyticsActions } from "./TrainingAnalyticsActions";

export const dynamic = "force-dynamic";

const SERVICE_NAMES = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingAnalyticsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;

  const today = new Date();
  const todayText = today.toISOString().slice(0, 10);
  const renewalCutoff = new Date(today);
  renewalCutoff.setUTCDate(renewalCutoff.getUTCDate() + 60);
  const renewalCutoffText = renewalCutoff.toISOString().slice(0, 10);

  const [[sessionStats], [participantStats], [certificateStats], serviceStats, renewals] = await Promise.all([
    db.select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${trainingSessions.status} = 'completed')::int`,
    }).from(trainingSessions),
    db.select({
      total: count(),
      passed: sql<number>`count(*) filter (where ${trainingParticipants.assessmentStatus} = 'passed')::int`,
      failed: sql<number>`count(*) filter (where ${trainingParticipants.assessmentStatus} = 'failed')::int`,
      highRisk: sql<number>`count(*) filter (where ${trainingParticipants.riskLevel} in ('high','critical'))::int`,
    }).from(trainingParticipants),
    db.select({
      active: sql<number>`count(*) filter (where ${trainingCertificates.status} = 'active' and (${trainingCertificates.expiryDate} is null or ${trainingCertificates.expiryDate} >= ${todayText}))::int`,
      revoked: sql<number>`count(*) filter (where ${trainingCertificates.status} = 'revoked')::int`,
      expiring: sql<number>`count(*) filter (where ${trainingCertificates.status} = 'active' and ${trainingCertificates.expiryDate} between ${todayText} and ${renewalCutoffText})::int`,
    }).from(trainingCertificates),
    db.select({
      serviceId: trainingSessions.serviceId,
      sessions: countDistinct(trainingSessions.id),
      participants: count(trainingParticipants.id),
      passed: sql<number>`count(${trainingParticipants.id}) filter (where ${trainingParticipants.assessmentStatus} = 'passed')::int`,
      failed: sql<number>`count(${trainingParticipants.id}) filter (where ${trainingParticipants.assessmentStatus} = 'failed')::int`,
      highRisk: sql<number>`count(${trainingParticipants.id}) filter (where ${trainingParticipants.riskLevel} in ('high','critical'))::int`,
    })
      .from(trainingSessions)
      .leftJoin(trainingParticipants, eq(trainingParticipants.sessionId, trainingSessions.id))
      .groupBy(trainingSessions.serviceId)
      .orderBy(trainingSessions.serviceId),
    db.select({
      certificateNumber: trainingCertificates.certificateNumber,
      expiryDate: trainingCertificates.expiryDate,
      participantName: trainingParticipants.fullName,
      serviceId: trainingCertificates.serviceId,
    })
      .from(trainingCertificates)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingCertificates.participantId))
      .where(and(
        eq(trainingCertificates.status, "active"),
        isNotNull(trainingCertificates.expiryDate),
        gte(trainingCertificates.expiryDate, todayText),
        lte(trainingCertificates.expiryDate, renewalCutoffText),
      ))
      .orderBy(trainingCertificates.expiryDate)
      .limit(100),
  ]);

  const assessed = Number(participantStats?.passed || 0) + Number(participantStats?.failed || 0);
  const passRate = assessed > 0 ? Math.round((Number(participantStats?.passed || 0) / assessed) * 1000) / 10 : 0;
  const exportRows = DRIVER_TRAINING_SERVICES.map((service) => {
    const stats = serviceStats.find((row) => row.serviceId === service.id);
    const passed = Number(stats?.passed || 0);
    const failed = Number(stats?.failed || 0);
    const totalAssessed = passed + failed;
    return {
      Service: service.title,
      Sessions: Number(stats?.sessions || 0),
      Participants: Number(stats?.participants || 0),
      Passed: passed,
      Failed: failed,
      "Pass Rate": totalAssessed > 0 ? `${Math.round((passed / totalAssessed) * 1000) / 10}%` : "0%",
      "High Risk": Number(stats?.highRisk || 0),
    };
  });

  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Driver Training Analytics"
        description="Programme delivery, competency, risk and certificate status."
        action={<TrainingAnalyticsActions rows={exportRows} />}
      />

      <div className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/driver-training" className="text-[var(--brand-accent)] hover:opacity-75">Overview</Link>
        <Link href="/driver-training/certificates" className="text-[var(--brand-accent)] hover:opacity-75">Certificates</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Sessions" value={Number(sessionStats?.total || 0)} hint={`${Number(sessionStats?.completed || 0)} completed`} tone="blue" icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard label="Participants" value={Number(participantStats?.total || 0)} hint="Registered" tone="violet" icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Pass rate" value={`${passRate}%`} hint={`${assessed} assessed`} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="High risk" value={Number(participantStats?.highRisk || 0)} hint="High or critical" tone="red" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Active certificates" value={Number(certificateStats?.active || 0)} hint={`${Number(certificateStats?.revoked || 0)} revoked`} tone="emerald" icon={<Award className="h-5 w-5" />} />
        <StatCard label="Renewals due" value={Number(certificateStats?.expiring || 0)} hint="Within 60 days" tone="amber" icon={<CalendarClock className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Performance by Service</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Service</th><th className="px-5 py-3 font-semibold">Sessions</th><th className="px-5 py-3 font-semibold">Participants</th><th className="px-5 py-3 font-semibold">Passed</th><th className="px-5 py-3 font-semibold">Failed</th><th className="px-5 py-3 font-semibold">Pass rate</th><th className="px-5 py-3 font-semibold">High risk</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {exportRows.map((row) => <tr key={String(row.Service)} className="hover:bg-[var(--vims-panel-soft)]/70"><td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{String(row.Service)}</td><td className="px-5 py-4 text-[var(--vims-ink-soft)]">{String(row.Sessions)}</td><td className="px-5 py-4 text-[var(--vims-ink-soft)]">{String(row.Participants)}</td><td className="px-5 py-4"><Badge tone="emerald">{String(row.Passed)}</Badge></td><td className="px-5 py-4"><Badge tone={Number(row.Failed) > 0 ? "red" : "slate"}>{String(row.Failed)}</Badge></td><td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{String(row["Pass Rate"])}</td><td className="px-5 py-4"><Badge tone={Number(row["High Risk"]) > 0 ? "red" : "slate"}>{String(row["High Risk"])}</Badge></td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Certificate Renewals</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Due within 60 days.</p>
          </div>
          {renewals.length === 0 ? (
            <div className="p-5 sm:p-6"><EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No renewals due" description="No active certificate expires within 60 days." /></div>
          ) : (
            <div className="divide-y divide-[var(--vims-line)]">
              {renewals.map((item) => <div key={item.certificateNumber} className="p-4 sm:px-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[var(--vims-ink)]">{item.participantName}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{SERVICE_NAMES.get(item.serviceId) || item.serviceId}</p></div><Badge tone="amber">{formatDate(item.expiryDate)}</Badge></div><p className="mt-2 font-mono text-xs text-[var(--vims-ink-muted)]">{item.certificateNumber}</p></div>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
