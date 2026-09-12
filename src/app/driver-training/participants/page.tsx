import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ClipboardCheck, UserPlus, UsersRound } from "lucide-react";
import { db } from "@/db";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { addTrainingParticipant, updateTrainingAttendance } from "../actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

function assessmentTone(status: string): "slate" | "emerald" | "red" | "amber" {
  if (status === "passed") return "emerald";
  if (status === "failed") return "red";
  if (status === "assessed") return "amber";
  return "slate";
}

export default async function TrainingParticipantsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to this module.</div>;
  const canManage = canManageTraining(user);

  const [openSessions, participants] = await Promise.all([
    db
      .select({
        id: trainingSessions.id,
        referenceNumber: trainingSessions.referenceNumber,
        title: trainingSessions.title,
        serviceId: trainingSessions.serviceId,
        startAt: trainingSessions.startAt,
        status: trainingSessions.status,
      })
      .from(trainingSessions)
      .where(inArray(trainingSessions.status, ["scheduled", "in_progress"]))
      .orderBy(trainingSessions.startAt)
      .limit(100),
    db
      .select({
        id: trainingParticipants.id,
        sessionId: trainingParticipants.sessionId,
        fullName: trainingParticipants.fullName,
        companyName: trainingParticipants.companyName,
        phone: trainingParticipants.phone,
        email: trainingParticipants.email,
        driverLicenseNumber: trainingParticipants.driverLicenseNumber,
        driverLicenseClass: trainingParticipants.driverLicenseClass,
        driverLicenseExpiry: trainingParticipants.driverLicenseExpiry,
        attendanceStatus: trainingParticipants.attendanceStatus,
        riskLevel: trainingParticipants.riskLevel,
        assessmentStatus: trainingParticipants.assessmentStatus,
        certificateEligible: trainingParticipants.certificateEligible,
        createdAt: trainingParticipants.createdAt,
        referenceNumber: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
        sessionTitle: trainingSessions.title,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .orderBy(desc(trainingParticipants.createdAt))
      .limit(200),
  ]);

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Participants"
        description="Register participants, record attendance and manage assessment status."
        action={
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/driver-training/sessions" className="text-[var(--brand-accent)] hover:opacity-75">Sessions</Link>
            <Link href="/driver-training/assessments" className="text-[var(--brand-accent)] hover:opacity-75">Assessments</Link>
          </div>
        }
      />

      {canManage && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100"><UserPlus className="h-4 w-4" /></div>
              <h2 className="font-semibold text-[var(--vims-ink)]">Register participant</h2>
            </div>
          </div>
          <form action={addTrainingParticipant} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Training session" required>
                <Select name="sessionId" required defaultValue="">
                  <option value="" disabled>Select session</option>
                  {openSessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Full name" required><TextInput name="fullName" required maxLength={200} /></Field>
            <Field label="Organization / company"><TextInput name="companyName" maxLength={220} /></Field>
            <Field label="Employee / staff number"><TextInput name="employeeNumber" maxLength={100} /></Field>
            <Field label="Phone"><TextInput name="phone" maxLength={50} /></Field>
            <Field label="Email"><TextInput name="email" type="email" maxLength={200} /></Field>
            <Field label="Driver licence number"><TextInput name="driverLicenseNumber" maxLength={100} /></Field>
            <Field label="Licence class"><TextInput name="driverLicenseClass" maxLength={50} /></Field>
            <Field label="Licence expiry"><TextInput name="driverLicenseExpiry" type="date" /></Field>
            <div className="sm:col-span-2 lg:col-span-4"><Field label="Notes"><TextArea name="notes" maxLength={4000} className="min-h-[72px]" /></Field></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><Button type="submit"><UserPlus className="h-4 w-4" /> Register</Button></div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Participant register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Attendance, assessment and certification status.</p>
        </div>
        {participants.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<UsersRound className="h-5 w-5" />} title="No participants registered" description="Register participants against an active training session." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Participant</th><th className="px-5 py-3 font-semibold">Session</th><th className="px-5 py-3 font-semibold">Licence</th><th className="px-5 py-3 font-semibold">Attendance</th><th className="px-5 py-3 font-semibold">Assessment</th><th className="px-5 py-3 font-semibold">Risk</th><th className="px-5 py-3 font-semibold">Certificate</th>{canManage && <th className="px-5 py-3 font-semibold">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {participants.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-[var(--vims-panel-soft)]/70">
                    <td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{item.fullName}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{item.companyName || item.email || item.phone || "No organization/contact"}</p></td>
                    <td className="px-5 py-4"><p className="font-medium text-[var(--vims-ink)]">{item.referenceNumber}</p><p className="mt-1 max-w-xs text-xs text-[var(--vims-ink-muted)]">{serviceNames.get(item.serviceId) || item.sessionTitle}</p></td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{item.driverLicenseNumber || "—"}{item.driverLicenseClass ? <span className="block text-xs text-[var(--vims-ink-muted)]">Class {item.driverLicenseClass}</span> : null}</td>
                    <td className="px-5 py-4"><Badge tone={item.attendanceStatus === "attended" ? "emerald" : item.attendanceStatus === "absent" ? "red" : "slate"}>{item.attendanceStatus}</Badge></td>
                    <td className="px-5 py-4"><Badge tone={assessmentTone(item.assessmentStatus)}>{item.assessmentStatus}</Badge></td>
                    <td className="px-5 py-4"><span className="text-[var(--vims-ink-soft)]">{item.riskLevel || "—"}</span></td>
                    <td className="px-5 py-4"><Badge tone={item.certificateEligible ? "emerald" : "slate"}>{item.certificateEligible ? "Eligible" : "Not eligible"}</Badge></td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex min-w-64 flex-col gap-2">
                          <form action={updateTrainingAttendance} className="flex items-center gap-2">
                            <input type="hidden" name="participantId" value={item.id} />
                            <Select name="status" defaultValue={item.attendanceStatus} className="min-w-32 py-1.5 text-xs">
                              <option value="registered">Registered</option><option value="attended">Attended</option><option value="absent">Absent</option><option value="withdrawn">Withdrawn</option>
                            </Select>
                            <Button type="submit" size="sm" variant="secondary">Save</Button>
                          </form>
                          {item.attendanceStatus !== "absent" && item.attendanceStatus !== "withdrawn" ? (
                            <Link href="/driver-training/assessments" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3 py-2 text-xs font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]">
                              <ClipboardCheck className="h-4 w-4" /> Assess
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
