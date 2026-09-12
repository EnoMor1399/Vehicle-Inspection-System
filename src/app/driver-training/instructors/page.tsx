import Link from "next/link";
import { eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, GraduationCap, ShieldAlert, UserRoundCheck } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingInstructorProfiles } from "@/db/training-readiness-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, TextArea, TextInput } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canServeAsInternalTrainingInstructor, canViewTraining } from "@/lib/training-access";
import { instructorDeploymentState, trainingCredentialState } from "@/lib/training-readiness-policy";
import { formatDate } from "@/lib/utils";
import { saveTrainingInstructorProfile } from "../readiness/actions";

export const dynamic = "force-dynamic";

function stateTone(state: string) {
  if (state === "ready") return "emerald" as const;
  if (state === "attention") return "amber" as const;
  if (state === "blocked" || state === "unavailable") return "red" as const;
  return "slate" as const;
}

export default async function TrainingInstructorsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [profileRows, internalUserRows] = await Promise.all([
    db
      .select({
        profile: trainingInstructorProfiles,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        accountActive: users.isActive,
      })
      .from(trainingInstructorProfiles)
      .innerJoin(users, eq(users.id, trainingInstructorProfiles.userId))
      .orderBy(users.name)
      .limit(300),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        permissions: users.permissions,
        isActive: users.isActive,
      })
      .from(users)
      .orderBy(users.name)
      .limit(500),
  ]);

  const profiles = profileRows.filter((row) => canServeAsInternalTrainingInstructor({
    role: row.role,
    permissions: row.permissions,
    isActive: row.accountActive,
  }));
  const internalUsers = internalUserRows.filter((account) => canServeAsInternalTrainingInstructor(account));

  const deploymentStates = profiles.map((row) => instructorDeploymentState({
    status: row.profile.status,
    trainerCertificationExpiry: row.profile.trainerCertificationExpiry,
    medicalFitnessExpiry: row.profile.medicalFitnessExpiry,
    driverLicenseExpiry: row.profile.driverLicenseExpiry,
    firstAidExpiry: row.profile.firstAidExpiry,
  }));
  const ready = deploymentStates.filter((state) => state === "ready").length;
  const attention = deploymentStates.filter((state) => state === "attention").length;
  const blocked = deploymentStates.filter((state) => state === "blocked" || state === "unavailable").length;
  const incomplete = deploymentStates.filter((state) => state === "incomplete").length;
  const profileUsers = new Set(profiles.map((row) => row.profile.userId));

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Instructor Qualifications"
        description="Manage internal instructors assigned to Driver Training & Assessment."
        action={<Link href="/driver-training/readiness" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Session readiness →</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Deployment ready" value={ready} hint="Active with current recorded credentials" tone="emerald" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Expiry attention" value={attention} hint="Credential due within 60 days" tone="amber" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Blocked / unavailable" value={blocked} hint="Expired credential or inactive profile" tone="red" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Evidence incomplete" value={incomplete} hint="No credential expiry evidence recorded" tone="slate" icon={<GraduationCap className="h-5 w-5" />} />
      </div>

      {canManage && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRoundCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-[var(--vims-ink)]">Add or update instructor qualification</h2>
                <p className="text-sm text-[var(--vims-ink-muted)]">Only active Driver Training & Assessment users are available for Internal Instructor assignment.</p>
              </div>
            </div>
          </div>
          <form action={saveTrainingInstructorProfile} className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <div className="sm:col-span-2 xl:col-span-2">
              <Field label="Driver Training user" required>
                <Select name="userId" required defaultValue="">
                  <option value="" disabled>Select instructor account</option>
                  {internalUsers.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}{profileUsers.has(account.id) ? " · Internal Instructor" : ""}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Profile status" required><Select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></Select></Field>
            <Field label="Driver licence number"><TextInput name="driverLicenseNumber" maxLength={100} /></Field>
            <div className="sm:col-span-2 xl:col-span-4"><Field label="Training specialties" hint="Separate specialties with commas or new lines."><TextArea name="specialties" maxLength={4000} className="min-h-[78px]" /></Field></div>
            <Field label="Driver licence expiry"><TextInput name="driverLicenseExpiry" type="date" /></Field>
            <Field label="Trainer certification"><TextInput name="trainerCertification" maxLength={220} /></Field>
            <Field label="Trainer certification expiry"><TextInput name="trainerCertificationExpiry" type="date" /></Field>
            <Field label="Medical fitness expiry"><TextInput name="medicalFitnessExpiry" type="date" /></Field>
            <Field label="First aid expiry"><TextInput name="firstAidExpiry" type="date" /></Field>
            <div className="sm:col-span-2 xl:col-span-3"><Field label="Qualification notes"><TextArea name="notes" maxLength={4000} className="min-h-[78px]" /></Field></div>
            <div className="flex items-end justify-end"><Button type="submit"><BadgeCheck className="h-4 w-4" /> Save qualification</Button></div>
          </form>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Internal Instructor register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Only instructor profiles linked to active Driver Training & Assessment users are shown.</p>
        </div>
        {profiles.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<GraduationCap className="h-5 w-5" />} title="No eligible Internal Instructors" description="Assign the user to Driver Training & Assessment before creating an instructor profile." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]"><tr><th className="px-5 py-3">Instructor</th><th className="px-5 py-3">Deployment state</th><th className="px-5 py-3">Specialties</th><th className="px-5 py-3">Trainer certificate</th><th className="px-5 py-3">Medical fitness</th><th className="px-5 py-3">Driver licence</th><th className="px-5 py-3">First aid</th></tr></thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {profiles.map(({ profile, name, email, accountActive }) => {
                  const deployment = instructorDeploymentState({ status: accountActive ? profile.status : "inactive", trainerCertificationExpiry: profile.trainerCertificationExpiry, medicalFitnessExpiry: profile.medicalFitnessExpiry, driverLicenseExpiry: profile.driverLicenseExpiry, firstAidExpiry: profile.firstAidExpiry });
                  const credential = trainingCredentialState([profile.trainerCertificationExpiry, profile.medicalFitnessExpiry, profile.driverLicenseExpiry, profile.firstAidExpiry]);
                  return <tr key={profile.id} className="align-top hover:bg-[var(--vims-panel-soft)]/70"><td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{name}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{profile.instructorCode} · {email}</p></td><td className="px-5 py-4"><Badge tone={stateTone(deployment)}>{deployment}</Badge><p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Credential state: {credential}</p></td><td className="px-5 py-4"><div className="flex max-w-sm flex-wrap gap-1">{profile.specialties.length > 0 ? profile.specialties.map((item) => <Badge key={item} tone="slate">{item}</Badge>) : <span className="text-[var(--vims-ink-muted)]">Not recorded</span>}</div></td><td className="px-5 py-4 text-[var(--vims-ink-soft)]"><p>{profile.trainerCertification || "—"}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{profile.trainerCertificationExpiry ? formatDate(profile.trainerCertificationExpiry) : "No expiry recorded"}</p></td><td className="px-5 py-4 text-[var(--vims-ink-soft)]">{profile.medicalFitnessExpiry ? formatDate(profile.medicalFitnessExpiry) : "—"}</td><td className="px-5 py-4 text-[var(--vims-ink-soft)]"><p>{profile.driverLicenseNumber || "—"}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{profile.driverLicenseExpiry ? formatDate(profile.driverLicenseExpiry) : "No expiry recorded"}</p></td><td className="px-5 py-4 text-[var(--vims-ink-soft)]">{profile.firstAidExpiry ? formatDate(profile.firstAidExpiry) : "—"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
