import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { GraduationCap, Mail, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { db } from "@/db";
import { locations, transporters, users } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ROLE_LABEL, canManageUsers } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import { formatDateTime } from "@/lib/utils";
import { UserAccessEditor } from "@/app/users/UserAccessEditor";

export const dynamic = "force-dynamic";

const ROLE_TONES: Record<string, "red" | "amber" | "blue" | "violet" | "slate" | "emerald"> = {
  super_admin: "red",
  admin: "red",
  operations_manager: "amber",
  supervisor: "amber",
  inspector: "blue",
  data_entry: "blue",
  auditor: "violet",
  compliance_officer: "violet",
  viewer: "slate",
  transporter_user: "emerald",
};

export default async function DriverTrainingUsersPage() {
  const user = await requireInternalUser();
  const canView = canViewTraining(user);
  const canManage = canManageTraining(user);

  if (!canView || !canManage) {
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
        description="Staff accounts assigned to training operations, assessments, independent review, certification and programme administration."
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
            <p className="mt-1 text-xs leading-5 text-slate-500">Training staff are managed independently from Vehicle Inspection staff. Participants and assessed drivers remain in the separate Participants register and are not system user accounts.</p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Training users" value={trainingUsers.length} hint="Assigned accounts" tone="blue" icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Active" value={activeUsers} hint="Can sign in" tone="emerald" icon={<UserCheck className="h-5 w-5" />} />
        <StatCard label="Review-capable roles" value={reviewers} hint="Subject to permissions" tone="violet" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Cross-system" value={crossSystemUsers} hint="Access to both systems" tone="slate" icon={<GraduationCap className="h-5 w-5" />} />
      </div>

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
