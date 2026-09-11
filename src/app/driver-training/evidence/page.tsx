import { desc, eq, inArray, sql } from "drizzle-orm";
import { CheckCircle2, Clock3, FileCheck2, Fingerprint, LogIn, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { db } from "@/db";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingAttendanceSignoffs, trainingEvidenceRecords } from "@/db/training-evidence-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { attendanceSignoffState, evidenceIntegrityState } from "@/lib/training-evidence-policy";
import { formatDateTime } from "@/lib/utils";
import {
  addTrainingEvidenceRecord,
  checkInTrainingParticipant,
  checkOutTrainingParticipant,
  confirmTrainingAttendance,
  disputeTrainingAttendance,
  verifyTrainingEvidenceRecord,
} from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

function attendanceTone(state: ReturnType<typeof attendanceSignoffState>) {
  if (state === "confirmed") return "emerald" as const;
  if (state === "disputed" || state === "void") return "red" as const;
  if (state === "checked_in" || state === "ready_to_confirm") return "blue" as const;
  if (state === "awaiting_signoff") return "amber" as const;
  return "slate" as const;
}

function evidenceTone(status: string) {
  if (status === "verified") return "emerald" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

export default async function TrainingEvidencePage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [sessions, participants, evidenceRecords, [attendanceStats], [evidenceStats]] = await Promise.all([
    db
      .select({
        id: trainingSessions.id,
        referenceNumber: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
        title: trainingSessions.title,
        status: trainingSessions.status,
        startAt: trainingSessions.startAt,
      })
      .from(trainingSessions)
      .where(inArray(trainingSessions.status, ["scheduled", "in_progress", "completed"]))
      .orderBy(desc(trainingSessions.startAt))
      .limit(120),
    db
      .select({
        id: trainingParticipants.id,
        fullName: trainingParticipants.fullName,
        sessionId: trainingParticipants.sessionId,
        attendanceStatus: trainingParticipants.attendanceStatus,
        sessionReference: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
        sessionTitle: trainingSessions.title,
        sessionStatus: trainingSessions.status,
        startAt: trainingSessions.startAt,
        signoffId: trainingAttendanceSignoffs.id,
        checkInAt: trainingAttendanceSignoffs.checkInAt,
        checkOutAt: trainingAttendanceSignoffs.checkOutAt,
        attendanceMinutes: trainingAttendanceSignoffs.attendanceMinutes,
        signoffStatus: trainingAttendanceSignoffs.status,
        participantAcknowledged: trainingAttendanceSignoffs.participantAcknowledged,
        instructorConfirmed: trainingAttendanceSignoffs.instructorConfirmed,
        confirmedAt: trainingAttendanceSignoffs.confirmedAt,
        signoffNotes: trainingAttendanceSignoffs.notes,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .leftJoin(
        trainingAttendanceSignoffs,
        eq(trainingAttendanceSignoffs.participantId, trainingParticipants.id),
      )
      .where(inArray(trainingSessions.status, ["scheduled", "in_progress", "completed"]))
      .orderBy(desc(trainingSessions.startAt), trainingParticipants.fullName)
      .limit(300),
    db
      .select({
        id: trainingEvidenceRecords.id,
        sessionId: trainingEvidenceRecords.sessionId,
        participantId: trainingEvidenceRecords.participantId,
        evidenceType: trainingEvidenceRecords.evidenceType,
        title: trainingEvidenceRecords.title,
        reference: trainingEvidenceRecords.reference,
        sha256: trainingEvidenceRecords.sha256,
        status: trainingEvidenceRecords.status,
        capturedAt: trainingEvidenceRecords.capturedAt,
        verifiedAt: trainingEvidenceRecords.verifiedAt,
        reviewNotes: trainingEvidenceRecords.reviewNotes,
        sessionReference: trainingSessions.referenceNumber,
        participantName: trainingParticipants.fullName,
      })
      .from(trainingEvidenceRecords)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingEvidenceRecords.sessionId))
      .leftJoin(trainingParticipants, eq(trainingParticipants.id, trainingEvidenceRecords.participantId))
      .orderBy(desc(trainingEvidenceRecords.capturedAt))
      .limit(250),
    db
      .select({
        confirmed: sql<number>`count(*) filter (where ${trainingAttendanceSignoffs.status} = 'confirmed')::int`,
        awaiting: sql<number>`count(*) filter (where ${trainingAttendanceSignoffs.status} = 'open' and ${trainingAttendanceSignoffs.checkOutAt} is not null)::int`,
      })
      .from(trainingAttendanceSignoffs),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${trainingEvidenceRecords.status} = 'pending')::int`,
        verified: sql<number>`count(*) filter (where ${trainingEvidenceRecords.status} = 'verified')::int`,
      })
      .from(trainingEvidenceRecords),
  ]);

  const participantOptions = participants.slice(0, 300);

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Attendance & Evidence"
        description="Capture auditable attendance, participant/instructor acknowledgement, and controlled references to training evidence without bypassing assessment or certificate controls."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Confirmed attendance" value={Number(attendanceStats?.confirmed || 0)} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <SummaryCard label="Awaiting sign-off" value={Number(attendanceStats?.awaiting || 0)} icon={<Clock3 className="h-5 w-5" />} tone="amber" />
        <SummaryCard label="Evidence pending review" value={Number(evidenceStats?.pending || 0)} icon={<FileCheck2 className="h-5 w-5" />} tone="amber" />
        <SummaryCard label="Verified evidence" value={Number(evidenceStats?.verified || 0)} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
      </div>

      {canManage && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Register evidence reference</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Store a controlled reference to an attendance register, assessment sheet, observation record, client confirmation, photo, or document. File bytes are not stored by this form.</p>
          </div>
          <form action={addTrainingEvidenceRecord} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
            <Field label="Training session" required>
              <Select name="sessionId" required defaultValue="">
                <option value="" disabled>Select session</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}
              </Select>
            </Field>
            <Field label="Participant" hint="Optional for session-level evidence">
              <Select name="participantId" defaultValue="">
                <option value="">Session-level evidence</option>
                {participantOptions.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName} · {participant.sessionReference}</option>)}
              </Select>
            </Field>
            <Field label="Evidence type" required>
              <Select name="evidenceType" defaultValue="attendance_register" required>
                <option value="attendance_register">Attendance register</option>
                <option value="assessment_sheet">Assessment sheet</option>
                <option value="practical_observation">Practical observation</option>
                <option value="client_confirmation">Client confirmation</option>
                <option value="photo_reference">Photo reference</option>
                <option value="document_reference">Document reference</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Title" required><TextInput name="title" required maxLength={220} /></Field>
            <div className="lg:col-span-2"><Field label="Controlled reference" required hint="Use an approved document ID, library path, or storage reference—not a secret token."><TextInput name="reference" required maxLength={500} /></Field></div>
            <div className="lg:col-span-2"><Field label="SHA-256 fingerprint" hint="Optional 64-character hexadecimal digest for integrity checking."><TextInput name="sha256" maxLength={64} spellCheck={false} /></Field></div>
            <div className="sm:col-span-2 lg:col-span-4"><Field label="Capture notes"><TextArea name="reviewNotes" maxLength={4000} className="min-h-[76px]" /></Field></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><Button type="submit"><FileCheck2 className="h-4 w-4" /> Register evidence</Button></div>
          </form>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Attendance sign-off register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Check-in and check-out establish duration. Attendance becomes confirmed only after participant acknowledgement and instructor confirmation are both captured.</p>
        </div>
        {participants.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<UsersRound className="h-5 w-5" />} title="No participants available" description="Register participants against Driver Training sessions before capturing attendance evidence." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Participant</th><th className="px-5 py-3 font-semibold">Session</th><th className="px-5 py-3 font-semibold">State</th><th className="px-5 py-3 font-semibold">Check-in</th><th className="px-5 py-3 font-semibold">Check-out</th><th className="px-5 py-3 font-semibold">Duration</th>{canManage && <th className="px-5 py-3 font-semibold">Controls</th>}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {participants.map((participant) => {
                  const state = attendanceSignoffState({
                    status: participant.signoffStatus,
                    checkInAt: participant.checkInAt,
                    checkOutAt: participant.checkOutAt,
                    participantAcknowledged: participant.participantAcknowledged,
                    instructorConfirmed: participant.instructorConfirmed,
                  });
                  const canCheckIn = state === "not_started" && ["scheduled", "in_progress"].includes(participant.sessionStatus) && participant.attendanceStatus !== "withdrawn";
                  const canCheckOut = state === "checked_in" && participant.sessionStatus === "in_progress";
                  const canConfirm = ["awaiting_signoff", "ready_to_confirm"].includes(state) && ["in_progress", "completed"].includes(participant.sessionStatus);
                  return (
                    <tr key={participant.id} className="align-top hover:bg-[var(--vims-panel-soft)]/70">
                      <td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{participant.fullName}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Operational status: {participant.attendanceStatus}</p></td>
                      <td className="px-5 py-4"><p className="font-medium text-[var(--vims-ink)]">{participant.sessionReference}</p><p className="mt-1 max-w-xs text-xs text-[var(--vims-ink-muted)]">{serviceNames.get(participant.serviceId) || participant.sessionTitle} · {participant.sessionStatus.replaceAll("_", " ")}</p></td>
                      <td className="px-5 py-4"><Badge tone={attendanceTone(state)}>{state.replaceAll("_", " ")}</Badge>{participant.signoffNotes && <p className="mt-2 max-w-xs text-xs text-[var(--vims-ink-muted)]">{participant.signoffNotes}</p>}</td>
                      <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{participant.checkInAt ? formatDateTime(participant.checkInAt) : "—"}</td>
                      <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{participant.checkOutAt ? formatDateTime(participant.checkOutAt) : "—"}</td>
                      <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{participant.attendanceMinutes ? `${participant.attendanceMinutes} min` : "—"}</td>
                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex max-w-md flex-col gap-2">
                            {canCheckIn && <form action={checkInTrainingParticipant}><input type="hidden" name="participantId" value={participant.id} /><Button type="submit" size="sm"><LogIn className="h-4 w-4" /> Check in</Button></form>}
                            {canCheckOut && <form action={checkOutTrainingParticipant}><input type="hidden" name="participantId" value={participant.id} /><Button type="submit" size="sm"><LogOut className="h-4 w-4" /> Check out</Button></form>}
                            {canConfirm && (
                              <details className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3">
                                <summary className="cursor-pointer text-xs font-semibold text-[var(--vims-ink)]">Confirm attendance</summary>
                                <form action={confirmTrainingAttendance} className="mt-3 space-y-3">
                                  <input type="hidden" name="participantId" value={participant.id} />
                                  <label className="flex items-start gap-2 text-xs text-[var(--vims-ink-soft)]"><input type="checkbox" name="participantAcknowledged" required className="mt-0.5 h-4 w-4" /> Participant acknowledgement captured</label>
                                  <label className="flex items-start gap-2 text-xs text-[var(--vims-ink-soft)]"><input type="checkbox" name="instructorConfirmed" required className="mt-0.5 h-4 w-4" /> Instructor confirms attendance</label>
                                  <TextArea name="notes" maxLength={4000} className="min-h-[64px]" placeholder="Optional sign-off notes" />
                                  <Button type="submit" size="sm"><CheckCircle2 className="h-4 w-4" /> Confirm</Button>
                                </form>
                              </details>
                            )}
                            {participant.signoffId && state !== "void" && (
                              <details className="rounded-xl border border-[var(--vims-line)] p-3">
                                <summary className="cursor-pointer text-xs font-semibold text-red-700">Dispute record</summary>
                                <form action={disputeTrainingAttendance} className="mt-3 space-y-2">
                                  <input type="hidden" name="participantId" value={participant.id} />
                                  <TextArea name="reason" required minLength={5} maxLength={2000} className="min-h-[64px]" placeholder="Reason for dispute" />
                                  <Button type="submit" size="sm" variant="secondary">Mark disputed</Button>
                                </form>
                              </details>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Evidence register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Evidence references remain internal operational records. Verification confirms the reference and integrity metadata were reviewed; it does not itself establish competence.</p>
        </div>
        {evidenceRecords.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="No training evidence registered" description="Register controlled references to training-delivery evidence for later review." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Evidence</th><th className="px-5 py-3 font-semibold">Scope</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Integrity</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Captured</th>{canManage && <th className="px-5 py-3 font-semibold">Review</th>}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {evidenceRecords.map((record) => {
                  const integrity = evidenceIntegrityState(record.sha256);
                  return (
                    <tr key={record.id} className="align-top hover:bg-[var(--vims-panel-soft)]/70">
                      <td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{record.title}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.evidenceType.replaceAll("_", " ")}</p></td>
                      <td className="px-5 py-4"><p className="font-medium text-[var(--vims-ink)]">{record.sessionReference}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.participantName || "Session-level"}</p></td>
                      <td className="px-5 py-4"><p className="max-w-sm break-all font-mono text-xs text-[var(--vims-ink-soft)]">{record.reference}</p></td>
                      <td className="px-5 py-4"><Badge tone={integrity === "fingerprinted" ? "blue" : "slate"}><Fingerprint className="h-3.5 w-3.5" /> {integrity.replaceAll("_", " ")}</Badge>{record.sha256 && <p className="mt-2 max-w-[180px] truncate font-mono text-[10px] text-[var(--vims-ink-muted)]" title={record.sha256}>{record.sha256}</p>}</td>
                      <td className="px-5 py-4"><Badge tone={evidenceTone(record.status)}>{record.status}</Badge>{record.reviewNotes && <p className="mt-2 max-w-xs text-xs text-[var(--vims-ink-muted)]">{record.reviewNotes}</p>}</td>
                      <td className="px-5 py-4 text-xs text-[var(--vims-ink-soft)]">{formatDateTime(record.capturedAt)}{record.verifiedAt && <span className="mt-1 block text-[var(--vims-ink-muted)]">Reviewed {formatDateTime(record.verifiedAt)}</span>}</td>
                      {canManage && (
                        <td className="px-5 py-4">
                          <form action={verifyTrainingEvidenceRecord} className="space-y-2">
                            <input type="hidden" name="evidenceId" value={record.id} />
                            <Select name="status" defaultValue={record.status === "rejected" ? "rejected" : "verified"} className="min-w-32 py-1.5 text-xs">
                              <option value="verified">Verify</option><option value="rejected">Reject</option>
                            </Select>
                            <TextInput name="reviewNotes" maxLength={4000} defaultValue={record.reviewNotes || ""} placeholder="Review note / rejection reason" className="min-w-64 text-xs" />
                            <Button type="submit" size="sm" variant="secondary">Save review</Button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-[var(--vims-ink-muted)]">Attendance and evidence records are internal operational safety records. Do not place passwords, access tokens, or private storage credentials in evidence references.</p>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "emerald" | "amber" }) {
  const toneClasses = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--vims-ink)]">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClasses}`}>{icon}</div></div></Card>;
}
