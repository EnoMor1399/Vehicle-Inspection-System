import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { GraduationCap, Mail, ShieldCheck, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { db } from "@/db";
import { locations, transporters, users } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, TextArea, TextInput } from "@/components/ui";
import { ROLE_LABEL, canManageUsers } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH } from "@/lib/password";
import { requireInternalUser } from "@/lib/require-auth";
import { canCreateDriverTrainingUsers, canManageTrainingUsers, canViewTraining } from "@/lib/training-access";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import { formatDateTime } from "@/lib/utils";
import { UserAccessEditor } from "@/app/users/UserAccessEditor";
import { createDriverTrainingUser } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_TONES: Record<string, "red" | "amber" | "blue" | "violet" | "slate" | "emerald"> = {
  super_admin: "red",
  admin: "red",
  operations_manager: "amber",
  supervisor: "amber",
  instructor: "blue",
  inspector: "blue",
  data_entry: "blue",
  auditor: "violet",
  compliance_officer: "violet",
  viewer: "slate",
  transporter_user: "emerald",
};

const TRAINING_ACCOUNT_OPTIONS = [
  { value: "operations_manager", label: "Training Operations Manager" },
  { value: "supervisor", label: "Training Supervisor / Reviewer" },
  { value: "instructor", label: "Instructor Account" },
  { value: "data_entry", label: "Training Data Officer" },
  { value: "auditor", label: "Training Auditor" },
  { value: "compliance_officer", label: "Training Compliance Officer" },
  { value: "viewer", label: "Read-only Training User" },
] as const;

type DriverTrainingUsersPageProps = {
  searchParams?: Promise<{
    createError?: string;
    created?: string;
  }>;
};

export default async function DriverTrainingUsersPage({ searchParams }: DriverTrainingUsersPageProps) {
  const params = searchParams ? await searchParams : {};
  const createError = typeof params.createError === "string" ? params.createError : "";
  const accountCreated = params.created === "1";
  const user = await requireInternalUser();
  const canView = canViewTraining(user);
  const canManageUsersForTraining = canManageTrainingUsers(user);
  const canCreateAccounts = canCreateDriverTrainingUsers(user);

  if (!canView || !canManageUsersForTraining) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-slate-950">Driver Training user administration required</h1>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">Your account can use Driver Training, but it is not authorized to administer staff access.</p>
              <Link href="/driver-training" className="mt-4 inline-flex text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Return to Driver Training</Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      permissions: users.permissions,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      locationId: users.locationId,
      transporterId: users.transporterId,
      locationName: locations.name,
    })
    .from(users)
    .leftJoin(locations, eq(locations.id, users.locationId))
    .orderBy(asc(users.name));

  const trainingUsers = allUsers.filter((account) => canAccessDriverTraining(account));
  const activeUsers = trainingUsers.filter((account) => account.isActive).length;
  const crossSystemUsers = trainingUsers.filter((account) => canAccessVehicleInspection(account)).length;
  const reviewers = trainingUsers.filter((account) => ["super_admin", "admin", "operations_manager", "supervisor"].includes(account.role)).length;

  const [locationOptions, transporterOptions] = await Promise.all([
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)),
    db.select({ id: transporters.id, companyName: transporters.companyName }).from(transporters).orderBy(asc(transporters.companyName)),
  ]);

  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Driver Training · Access Control"
        title="Driver Training Users"
        description="Create and administer staff accounts for training delivery, assessment, review, certification and programme operations."
        action={
          canManageUsers(user) ? (
            <Link
              href="/users"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Vehicle Inspection users
            </Link>
          ) : undefined
        }
      />

      <Card className="mb-6 border-l-4 border-l-[var(--brand-color)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><GraduationCap className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Driver Training account boundary</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">New accounts created here are assigned to Driver Training & Assessment only. Instructor Accounts receive operational instructor privileges and an Internal Instructor profile, but cannot independently approve their own assessments or administer user accounts. Participants and assessed drivers remain in the Participants register.</p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Training users" value={trainingUsers.length} hint="Assigned accounts" tone="blue" icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Active" value={activeUsers} hint="Can sign in" tone="emerald" icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Review-capable roles" value={reviewers} hint="Subject to permissions" tone="violet" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Cross-system" value={crossSystemUsers} hint="Access to both systems" tone="slate" icon={<GraduationCap className="h-5 w-5" />} />
      </div>

      {canCreateAccounts && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-800">
                <UserPlus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Create Driver Training account</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Provision an internal user account with Driver Training access. Instructor Accounts automatically receive an active Internal Instructor profile.</p>
              </div>
            </div>
          </div>

          <form action={createDriverTrainingUser} className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            {createError && (
              <div role="alert" className="sm:col-span-2 xl:col-span-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="font-semibold">Account not created.</span> {createError}
              </div>
            )}
            {accountCreated && !createError && (
              <div role="status" className="sm:col-span-2 xl:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span className="font-semibold">Account created successfully.</span> The new Driver Training user can now sign in with the credentials you assigned.
              </div>
            )}
            <Field label="Full name" required>
              <TextInput name="name" required minLength={2} maxLength={200} autoComplete="name" placeholder="Full name" />
            </Field>
            <Field label="Email address" required>
              <TextInput name="email" type="email" required maxLength={200} autoComplete="email" placeholder="name@example.com" />
            </Field>
            <Field label="Phone number">
              <TextInput name="phone" type="tel" maxLength={50} autoComplete="tel" placeholder="Optional" />
            </Field>
            <Field label="Account function" required>
              <Select name="role" required defaultValue="instructor">
                {user.role === "super_admin" && <option value="admin">Training Administrator</option>}
                {TRAINING_ACCOUNT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2 xl:col-span-2">
              <Field label="Initial password" required hint={`Minimum ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number and special character. Spaces are not allowed.`}>
                <TextInput
                  name="password"
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={128}
                  pattern="\S*"
                  title="Password must not contain spaces."
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <div className="sm:col-span-2 xl:col-span-2">
              <Field label="Instructor specialties" hint="Optional. Applied when Account function is Instructor Account. Separate entries with commas or new lines.">
                <TextArea name="specialties" maxLength={4000} className="min-h-[78px]" placeholder="Defensive driving, heavy vehicle operations" />
              </Field>
            </div>
            <div className="sm:col-span-2 xl:col-span-3 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">Access policy:</span> the account is active and limited to Driver Training & Assessment. Instructor Accounts can deliver sessions, manage participants and record assessments, but cannot approve assessments or administer accounts. Only a Super Administrator can create a Training Administrator.</p>
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit"><UserPlus className="h-4 w-4" /> Create account</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Training staff accounts</h2>
            <p className="mt-1 text-xs text-slate-500">These accounts are distinct from assessed drivers and training participants.</p>
          </div>
          <Link href="/driver-training/participants" className="text-xs font-semibold text-[var(--brand-accent)] hover:opacity-75">Open participant register →</Link>
        </div>

        {trainingUsers.length === 0 ? (
          <EmptyState icon={<UsersRound className="h-8 w-8" />} title="No Driver Training users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4 text-left">User</th>
                  <th className="py-2 pr-4 text-left">Role</th>
                  <th className="py-2 pr-4 text-left">Access</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-left">Last login</th>
                  <th className="py-2 text-right">Administration</th>
                </tr>
              </thead>
              <tbody>
                {trainingUsers.map((account) => {
                  const inspectionAccess = canAccessVehicleInspection(account);
                  return (
                    <tr key={account.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                            {account.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{account.name}</p>
                            <p className="flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3 w-3" /> {account.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><Badge tone={ROLE_TONES[account.role] || "slate"}>{ROLE_LABEL[account.role] || account.role}</Badge></td>
                      <td className="py-3 pr-4"><Badge tone={inspectionAccess ? "violet" : "blue"}>{inspectionAccess ? "Both systems" : "Driver Training"}</Badge></td>
                      <td className="py-3 pr-4"><Badge tone={account.isActive ? "emerald" : "slate"}>{account.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}</td>
                      <td className="py-3 text-right">
                        <UserAccessEditor
                          user={{
                            id: account.id,
                            name: account.name,
                            email: account.email,
                            role: account.role,
                            isActive: account.isActive,
                            vehicleInspectionAccess: inspectionAccess,
                            driverTrainingAccess: true,
                            locationId: account.locationId,
                            transporterId: account.transporterId,
                          }}
                          locations={locationOptions}
                          transporters={transporterOptions}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
