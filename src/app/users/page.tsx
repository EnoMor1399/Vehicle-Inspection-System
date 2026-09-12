import Link from "next/link";
import { db } from "@/db";
import { users, locations, transporters } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Car, GraduationCap, Users, Shield, Mail, LockKeyhole } from "lucide-react";
import { canManageUsers, ROLE_LABEL } from "@/lib/auth";
import { requirePermission } from "@/lib/require-auth";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import { formatDateTime } from "@/lib/utils";
import { UserAccessEditor } from "./UserAccessEditor";

export const dynamic = "force-dynamic";

const ROLE_GROUPS = [
  { key: "super_admin", tone: "red" as const, label: "Super Administrator", desc: "Full system access" },
  { key: "admin", tone: "red" as const, label: "Administrator", desc: "Manage inspection modules" },
  { key: "operations_manager", tone: "amber" as const, label: "Operations Manager", desc: "Daily inspection operations" },
  { key: "supervisor", tone: "amber" as const, label: "Supervisor", desc: "Approve inspections" },
  { key: "inspector", tone: "blue" as const, label: "Inspector", desc: "Perform inspections" },
  { key: "data_entry", tone: "blue" as const, label: "Data Entry Officer", desc: "Import & data" },
  { key: "auditor", tone: "violet" as const, label: "Auditor", desc: "Audit & reports" },
  { key: "compliance_officer", tone: "violet" as const, label: "Compliance Officer", desc: "Compliance monitoring" },
  { key: "viewer", tone: "slate" as const, label: "Viewer", desc: "Read-only" },
  { key: "transporter_user", tone: "emerald" as const, label: "Transporter Portal", desc: "External access" },
];

export default async function UsersPage() {
  const user = await requirePermission("users");
  const canManage = canManageUsers(user);

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
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

  const vehicleUsers = allUsers.filter((account) => canAccessVehicleInspection(account));

  const [locationOptions, transporterOptions] = await Promise.all([
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)),
    db.select({ id: transporters.id, companyName: transporters.companyName }).from(transporters).orderBy(asc(transporters.companyName)),
  ]);

  const matrix = [
    { resource: "Transporters", super_admin: true, admin: true, operations_manager: true, supervisor: true, inspector: false, data_entry: true, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Vehicles", super_admin: true, admin: true, operations_manager: true, supervisor: true, inspector: true, data_entry: true, auditor: false, compliance_officer: true, viewer: false, transporter_user: false },
    { resource: "Inspections", super_admin: true, admin: true, operations_manager: true, supervisor: true, inspector: true, data_entry: false, auditor: false, compliance_officer: true, viewer: false, transporter_user: false },
    { resource: "Approve", super_admin: true, admin: true, operations_manager: false, supervisor: true, inspector: false, data_entry: false, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Reports", super_admin: true, admin: true, operations_manager: true, supervisor: true, inspector: false, data_entry: false, auditor: true, compliance_officer: true, viewer: false, transporter_user: false },
    { resource: "Import/Export", super_admin: true, admin: true, operations_manager: false, supervisor: false, inspector: false, data_entry: true, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Users", super_admin: true, admin: true, operations_manager: false, supervisor: false, inspector: false, data_entry: false, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Locations", super_admin: true, admin: true, operations_manager: true, supervisor: false, inspector: false, data_entry: false, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Audit Log", super_admin: true, admin: true, operations_manager: false, supervisor: false, inspector: false, data_entry: false, auditor: true, compliance_officer: false, viewer: false, transporter_user: false },
    { resource: "Settings", super_admin: true, admin: true, operations_manager: false, supervisor: false, inspector: false, data_entry: false, auditor: false, compliance_officer: false, viewer: false, transporter_user: false },
  ];

  const roleCounts = ROLE_GROUPS.map((r) => ({
    ...r,
    count: vehicleUsers.filter((account) => account.role === r.key).length,
  }));

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Vehicle Inspection · Access Control"
        title="Vehicle Inspection Users"
        description="Accounts assigned to fleet, vehicle inspection, station, reporting and inspection administration. Driver Training users are managed separately."
        action={
          canAccessDriverTraining(user) ? (
            <Link
              href="/driver-training/users"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <GraduationCap className="h-4 w-4" /> Driver Training users
            </Link>
          ) : canManage ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              <LockKeyhole className="h-4 w-4" /> Controlled account administration
            </div>
          ) : undefined
        }
      />

      <Card className="mb-6 border-l-4 border-l-[var(--brand-color)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"><Car className="h-4 w-4" /></div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Vehicle Inspection account boundary</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Only accounts assigned to Vehicle Inspection appear here. An account may be assigned to both systems only when cross-department access is required.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {roleCounts.map((r) => (
          <Card key={r.key} className="p-3">
            <Badge tone={r.tone} className="mb-2">{r.label}</Badge>
            <p className="text-2xl font-semibold">{r.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6 mb-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Vehicle Inspection Permission Matrix</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 uppercase tracking-wider">
              <th className="py-2 pr-4">Resource</th>
              {ROLE_GROUPS.map((r) => (
                <th key={r.key} className="py-2 px-2 text-center whitespace-nowrap">{r.label.split(" ")[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.resource} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{row.resource}</td>
                {ROLE_GROUPS.map((r) => {
                  const ok = (row as Record<string, string | boolean>)[r.key];
                  return (
                    <td key={r.key} className="py-2 px-2 text-center">
                      {ok ? <span className="inline-block h-4 w-4 rounded-full bg-emerald-500 text-white text-xs leading-4">✓</span>
                          : <span className="inline-block h-4 w-4 rounded-full bg-slate-100 text-slate-400 text-xs leading-4">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2"><Users className="h-5 w-5" /> Vehicle Inspection Users ({vehicleUsers.length})</h2>
        {vehicleUsers.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No Vehicle Inspection users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-4 text-left">User</th>
                  <th className="py-2 pr-4 text-left">Role</th>
                  <th className="py-2 pr-4 text-left">Access</th>
                  <th className="py-2 pr-4 text-left">Station</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-left">Last Login</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vehicleUsers.map((account) => {
                  const role = ROLE_GROUPS.find((r) => r.key === account.role);
                  const trainingAccess = canAccessDriverTraining(account);
                  return (
                    <tr key={account.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-semibold">
                            {account.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{account.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {account.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><Badge tone={role?.tone || "slate"}>{ROLE_LABEL[account.role] || account.role}</Badge></td>
                      <td className="py-3 pr-4"><Badge tone={trainingAccess ? "violet" : "blue"}>{trainingAccess ? "Both systems" : "Vehicle Inspection"}</Badge></td>
                      <td className="py-3 pr-4 text-slate-600">{account.locationName || "—"}</td>
                      <td className="py-3 pr-4"><Badge tone={account.isActive ? "emerald" : "slate"}>{account.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-3 pr-4 text-slate-600 text-xs">{account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}</td>
                      <td className="py-3 text-right">
                        {canManage && (
                          <UserAccessEditor
                            user={{
                              id: account.id,
                              name: account.name,
                              email: account.email,
                              role: account.role,
                              isActive: account.isActive,
                              vehicleInspectionAccess: true,
                              driverTrainingAccess: trainingAccess,
                              locationId: account.locationId,
                              transporterId: account.transporterId,
                            }}
                            locations={locationOptions}
                            transporters={transporterOptions}
                          />
                        )}
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
