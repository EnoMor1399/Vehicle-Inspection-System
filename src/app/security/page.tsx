import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { sessions, securityEvents, users } from "@/db/schema";
import { eq, desc, and, gt } from "drizzle-orm";
import { Card } from "@/components/ui";
import { Shield, AlertTriangle, Activity, Lock, Smartphone, LogOut } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { revokeSessionAction, revokeAllSessionsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SecurityDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch active sessions for current user
  const activeSessions = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(sessions.createdAt))
    .limit(10);

  // Fetch recent security events
  const recentEvents = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, user.id))
    .orderBy(desc(securityEvents.createdAt))
    .limit(20);

  // Check if 2FA is enabled
  const has2FA = user.twoFactorEnabled;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Dashboard</h1>
        <p className="text-muted-foreground">Manage your account security settings</p>
      </div>

      {/* 2FA Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${has2FA ? "bg-green-100" : "bg-yellow-100"}`}>
              <Lock className={`h-6 w-6 ${has2FA ? "text-green-600" : "text-yellow-600"}`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
              <p className="text-sm text-muted-foreground">
                {has2FA ? "Your account is protected with 2FA" : "Add an extra layer of security to your account"}
              </p>
            </div>
          </div>
          {!has2FA && (
            <a
              href="/security/setup-2fa"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Enable 2FA
            </a>
          )}
        </div>
      </Card>

      {/* Active Sessions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Active Sessions</h2>
          </div>
          {activeSessions.length > 1 && (
            <form action={revokeAllSessionsAction}>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-md hover:bg-red-100 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Revoke All Other Sessions
              </button>
            </form>
          )}
        </div>
        <div className="space-y-3">
          {activeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions</p>
          ) : (
            activeSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {session.userAgent?.split(" ")[0] || "Unknown Device"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.ipAddress} • {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Revoke
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Recent Security Events */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Recent Security Events</h2>
        </div>
        <div className="space-y-3">
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent security events</p>
          ) : (
            recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                <div className={`p-2 rounded-full ${
                  event.severity === "critical" ? "bg-red-100" :
                  event.severity === "warning" ? "bg-yellow-100" :
                  "bg-blue-100"
                }`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    event.severity === "critical" ? "text-red-600" :
                    event.severity === "warning" ? "text-yellow-600" :
                    "text-blue-600"
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{event.eventType}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.ipAddress} • {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                  </p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
