import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Bell, Calendar, Mail, MessageSquare, CheckCircle2, AlertTriangle, ShieldAlert, FileText, Activity } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { markAllRead, markRead } from "./actions";
import { requirePermission } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePermission("notifications");
  const all = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  const unread = all.filter((n) => !n.readAt).length;
  const byType: Record<string, number> = {};
  all.forEach((n) => { byType[n.type] = (byType[n.type] || 0) + 1; });

  const iconMap: Record<string, typeof Bell> = {
    inspection_due: Calendar,
    certificate_expiring: AlertTriangle,
    inspection_failed: ShieldAlert,
    reinspection_due: Activity,
    document_expiry: FileText,
    monthly_summary: CheckCircle2,
    system: Bell,
  };
  const toneMap: Record<string, "emerald" | "red" | "amber" | "blue" | "violet" | "slate"> = {
    inspection_due: "blue",
    certificate_expiring: "amber",
    inspection_failed: "red",
    reinspection_due: "amber",
    document_expiry: "amber",
    monthly_summary: "emerald",
    system: "slate",
  };

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications & Reminders"
        description="Your account alerts and operational reminders. Delivery channels shown here reflect the notification records configured for your account."
        action={
          unread > 0 ? (
            <form action={markAllRead}>
              <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                <CheckCircle2 className="h-4 w-4 inline mr-1" /> Mark all read ({unread})
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><p className="text-xs text-slate-500">Unread</p><p className="text-2xl font-semibold text-red-600 mt-1">{unread}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Certificates Expiring</p><p className="text-2xl font-semibold text-amber-600 mt-1">{byType.certificate_expiring || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Inspections Due</p><p className="text-2xl font-semibold text-blue-600 mt-1">{byType.inspection_due || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Failed Results</p><p className="text-2xl font-semibold text-red-600 mt-1">{byType.inspection_failed || 0}</p></Card>
      </div>

      {all.length === 0 ? (
        <Card><EmptyState icon={<Bell className="h-10 w-10" />} title="No notifications" description="You're all caught up." /></Card>
      ) : (
        <Card className="p-6">
          <div className="space-y-3">
            {all.map((n) => {
              const Icon = iconMap[n.type] || Bell;
              const tone = toneMap[n.type] || "slate";
              return (
                <form key={n.id} action={markRead} className="contents">
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition ${!n.readAt ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-slate-50"}`}
                  >
                    <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
                      tone === "red" ? "bg-red-100 text-red-700" :
                      tone === "amber" ? "bg-amber-100 text-amber-700" :
                      tone === "blue" ? "bg-blue-100 text-blue-700" :
                      tone === "emerald" ? "bg-emerald-100 text-emerald-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-medium ${!n.readAt ? "text-slate-950" : "text-slate-700"}`}>{n.title}</p>
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                        <Badge tone={tone}>{n.type.replace("_", " ")}</Badge>
                        {n.channel === "email" && <Badge tone="blue"><Mail className="h-3 w-3" /> Email</Badge>}
                        {n.channel === "sms" && <Badge tone="violet"><MessageSquare className="h-3 w-3" /> SMS</Badge>}
                      </div>
                      <p className="text-sm text-slate-600">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDateTime(n.createdAt)}
                        {n.dueDate && <span className="ml-2">· Due: {formatDate(n.dueDate)}</span>}
                        {n.sentAt && <span className="ml-2">· Sent {formatDateTime(n.sentAt)}</span>}
                      </p>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
