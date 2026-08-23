import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { ScrollText, UserCheck, Plus, Pencil, Trash2, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Governance"
        title="Audit Log"
        description="Every create, update, delete and inspection action is recorded with the responsible user, timestamp, and full context."
      />

      {logs.length === 0 ? (
        <Card><EmptyState icon={<ScrollText className="h-10 w-10" />} title="No audit records" description="Activities will appear here as users interact with the system." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-semibold">
                          {(l.userName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </div>
                        <span className="font-medium">{l.userName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><ActionBadge action={l.action} /></td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{l.entityType}</p>
                      {l.entityLabel && <p className="text-xs text-slate-500">{l.entityLabel}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { tone: "emerald" | "amber" | "red" | "blue" | "violet" | "slate"; label: string; icon: typeof CheckCircle2 }> = {
    create: { tone: "emerald", label: "Create", icon: Plus },
    update: { tone: "blue", label: "Update", icon: Pencil },
    delete: { tone: "red", label: "Delete", icon: Trash2 },
    restore: { tone: "emerald", label: "Restore", icon: CheckCircle2 },
    inspect: { tone: "violet", label: "Inspect", icon: ClipboardCheck },
    approve: { tone: "emerald", label: "Approve", icon: CheckCircle2 },
    login: { tone: "slate", label: "Login", icon: UserCheck },
  };
  const m = map[action] || { tone: "slate" as const, label: action, icon: ScrollText };
  const Icon = m.icon;
  return <Badge tone={m.tone}><Icon className="h-3.5 w-3.5" /> {m.label}</Badge>;
}
