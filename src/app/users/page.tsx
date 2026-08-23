import { db } from "@/db";
import { users, locations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Users, Shield, MapPin, Mail, Activity } from "lucide-react";
import { getCurrentUser, canManageUsers, ROLE_LABEL } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLE_GROUPS = [
  { key: "super_admin", tone: "red" as const, label: "Super Administrator", desc: "Full system access" },
  { key: "admin", tone: "red" as const, label: "Administrator", desc: "Manage all modules" },
  { key: "operations_manager", tone: "amber" as const, label: "Operations Manager", desc: "Daily operations" },
  { key: "supervisor", tone: "amber" as const, label: "Supervisor", desc: "Approve inspections" },
  { key: "inspector", tone: "blue" as const, label: "Inspector", desc: "Perform inspections" },
  { key: "data_entry", tone: "blue" as const, label: "Data Entry Officer", desc: "Import & data" },
  { key: "auditor", tone: "violet" as const, label: "Auditor", desc: "Audit & reports" },
  { key: "compliance_officer", tone: "violet" as const, label: "Compliance Officer", desc: "Compliance monitoring" },
  { key: "viewer", tone: "slate" as const, label: "Viewer", desc: "Read-only" },
  { key: "transporter_user", tone: "emerald" as const, label: "Transporter Portal", desc: "External access" },
];

export default async function UsersPage() {
  const user = await getCurrentUser();
  const canManage = canManageUsers(user);

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      locationName: locations.name,
    })
    .from(users)
    .leftJoin(locations, eq(locations.id, users.locationId))
    .orderBy(asc(users.name));

  // Permission matrix: which role can do what
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
    count: allUsers.filter((u) => u.role === r.key).length,
  }));

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Access Control"
        title="Users & Role-Based Permissions"
        description="10 distinct roles with fine-grained permissions for view, create, edit, delete, approve, import, export and print."
        action={canManage ? (
          <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            + Invite User
          </button>
        ) : undefined}
      />

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
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Permission Matrix</h2>
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
                  const ok = (row as any)[r.key];
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
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2"><Users className="h-5 w-5" /> All Users ({allUsers.length})</h2>
        {allUsers.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No users yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-4 text-left">User</th>
                  <th className="py-2 pr-4 text-left">Role</th>
                  <th className="py-2 pr-4 text-left">Station</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-left">Last Login</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => {
                  const role = ROLE_GROUPS.find((r) => r.key === u.role);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-semibold">
                            {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><Badge tone={role?.tone || "slate"}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
                      <td className="py-3 pr-4 text-slate-600">{u.locationName || "—"}</td>
                      <td className="py-3 pr-4"><Badge tone={u.isActive ? "emerald" : "slate"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-3 pr-4 text-slate-600 text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                      <td className="py-3 text-right">
                        {canManage && <button className="text-amber-700 hover:text-amber-800 text-sm font-medium">Edit →</button>}
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
