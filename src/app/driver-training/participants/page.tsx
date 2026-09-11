import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ClipboardCheck, UserPlus, UsersRound } from "lucide-react";
import { db } from "@/db";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";
import { addTrainingParticipant, recordTrainingAssessment, updateTrainingAttendance } from "../actions";

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
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
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
        title="Participants & Assessments"
        description="Register drivers and equipment operators, track attendance, capture proficiency outcomes, and identify high-risk operators requiring coaching or retraining."
        action={<Link href="/driver-training/sessions" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Training sessions →</Link>}
      />

      {canManage && (
        <div className="mb-6 grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><UserPlus className="h-5 w-5" /></div>
                <div><h2 className="font-semibold text-[var(--vims-ink)]">Register participant</h2><p className="text-sm text-[var(--vims-ink-muted)]">Add an operator to an open training session.</p></div>
              </div>
            </div>
            <form action={addTrainingParticipant} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-2"><Field label="Notes"><TextArea name="notes" maxLength={4000} className="min-h-[80px]" /></Field></div>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><UserPlus className="h-4 w-4" /> Register participant</Button></div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100"><ClipboardCheck className="h-5 w-5" /></div>
                <div><h2 className="font-semibold text-[var(--vims-ink)]">Record assessment</h2><p className="text-sm text-[var(--vims-ink-muted)]">Capture theory/practical results and safety risk level.</p></div>
              </div>
            </div>
            <form action={recordTrainingAssessment} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <Field label="Participant" required>
                  <Select name="participantId" required defaultValue="">
                    <option value="" disabled>Select participant</option>
                    {participants.filter((item) => item.attendanceStatus !== "withdrawn").map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.referenceNumber}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Assessment type" required>
                <Select name="assessmentType" defaultValue="post_training" required>
                  <option value="pre_training">Pre-training</option>
                  <option value="post_training">Post-training</option>
                  <option value="proficiency">Driving proficiency</option>
                  <option value="practical">Practical</option>
                  <option value="refresher">Refresher</option>
                </Select>
              </Field>
              <Field label="Result" required>
                <Select name="result" defaultValue="competent" required>
                  <option value="competent">Competent</option>
                  <option value="not_yet_competent">Not yet competent</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </Select>
              </Field>
              <Field label="Theory score (%)"><TextInput name="theoryScore" type="number" min={0} max={100} step="0.01" /></Field>
              <Field label="Practical score (%)"><TextInput name="practicalScore" type="number" min={0} max={100} step="0.01" /></Field>
              <Field label="Risk level">
                <Select name="riskLevel" defaultValue="">
                  <option value="">Not classified</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </Select>
              </Field>
              <Field label="Strengths"><TextInput name="strengths" maxLength={4000} /></Field>
              <div className="sm:col-span-2"><Field label="Improvement areas" hint="Separate items with commas or new lines."><TextArea name="improvementAreas" maxLength={4000} className="min-h-[75px]" /></Field></div>
              <div className="sm:col-span-2"><Field label="Assessment remarks"><TextArea name="remarks" maxLength={4000} className="min-h-[75px]" /></Field></div>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><ClipboardCheck className="h-4 w-4" /> Save assessment</Button></div>
            </form>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Participant register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Latest 200 registrations with attendance, assessment, risk, and certificate eligibility.</p>
        </div>
        {participants.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<UsersRound className="h-5 w-5" />} title="No participants registered" description="Register drivers or operators against a scheduled training session." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Participant</th><th className="px-5 py-3 font-semibold">Session</th><th className="px-5 py-3 font-semibold">Licence</th><th className="px-5 py-3 font-semibold">Attendance</th><th className="px-5 py-3 font-semibold">Assessment</th><th className="px-5 py-3 font-semibold">Risk</th><th className="px-5 py-3 font-semibold">Certificate</th>{canManage && <th className="px-5 py-3 font-semibold">Attendance action</th>}</tr>
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
                        <form action={updateTrainingAttendance} className="flex items-center gap-2">
                          <input type="hidden" name="participantId" value={item.id} />
                          <Select name="status" defaultValue={item.attendanceStatus} className="min-w-32 py-1.5 text-xs">
                            <option value="registered">Registered</option><option value="attended">Attended</option><option value="absent">Absent</option><option value="withdrawn">Withdrawn</option>
                          </Select>
                          <Button type="submit" size="sm" variant="secondary">Save</Button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-[var(--vims-ink-muted)]">Participant records are operational safety records. Access is limited to authenticated internal users with Driver Training permissions.</p>
    </div>
  );
}
