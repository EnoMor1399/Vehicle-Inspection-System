import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL || "";
const expectedDatabase = (process.env.EXPECTED_DATABASE_NAME || "Vehicle-Inspection-Enterprise").trim();
const mode = (process.env.RETENTION_MODE || "preview").trim().toLowerCase();

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!new Set(["preview", "execute"]).has(mode)) throw new Error("RETENTION_MODE must be preview or execute");

function boundedDays(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

function normalizeDatabaseUrl(value) {
  const url = new URL(value);
  if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

const policy = {
  expiredSessionDays: boundedDays("RETENTION_EXPIRED_SESSION_DAYS", 30, 1, 365),
  loginAttemptDays: boundedDays("RETENTION_LOGIN_ATTEMPT_DAYS", 90, 7, 730),
  resolvedSecurityEventDays: boundedDays("RETENTION_RESOLVED_SECURITY_EVENT_DAYS", 365, 30, 3650),
  readNotificationDays: boundedDays("RETENTION_READ_NOTIFICATION_DAYS", 180, 30, 3650),
  expiredApiKeyDays: boundedDays("RETENTION_EXPIRED_API_KEY_DAYS", 90, 7, 3650),
};

const client = new Client({
  connectionString: normalizeDatabaseUrl(databaseUrl),
  application_name: "vims-security-retention",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

await client.connect();
try {
  const target = await client.query("select current_database() as name");
  const actualDatabase = target.rows[0]?.name || "";
  if (expectedDatabase && actualDatabase !== expectedDatabase) {
    throw new Error(`Refusing retention against database ${actualDatabase}; expected ${expectedDatabase}`);
  }

  const preview = await client.query(
    `select
      (select count(*)::int from sessions where is_active = true and expires_at <= now()) as expired_active_sessions,
      (select count(*)::int from sessions where expires_at < now() - ($1::int * interval '1 day')) as old_sessions,
      (select count(*)::int from login_attempts where created_at < now() - ($2::int * interval '1 day')) as old_login_attempts,
      (select count(*)::int from security_events where resolved = true and created_at < now() - ($3::int * interval '1 day')) as old_resolved_security_events,
      (select count(*)::int from notifications where read_at is not null and created_at < now() - ($4::int * interval '1 day')) as old_read_notifications,
      (select count(*)::int from api_keys where expires_at is not null and expires_at < now() - ($5::int * interval '1 day')) as old_expired_api_keys`,
    [
      policy.expiredSessionDays,
      policy.loginAttemptDays,
      policy.resolvedSecurityEventDays,
      policy.readNotificationDays,
      policy.expiredApiKeyDays,
    ],
  );

  if (mode === "preview") {
    console.log(JSON.stringify({ mode, database: actualDatabase, policy, candidates: preview.rows[0] }, null, 2));
  } else {
    await client.query("begin");
    try {
      const deactivated = await client.query(
        "update sessions set is_active = false where is_active = true and expires_at <= now()",
      );
      const sessions = await client.query(
        "delete from sessions where expires_at < now() - ($1::int * interval '1 day')",
        [policy.expiredSessionDays],
      );
      const attempts = await client.query(
        "delete from login_attempts where created_at < now() - ($1::int * interval '1 day')",
        [policy.loginAttemptDays],
      );
      const securityEvents = await client.query(
        "delete from security_events where resolved = true and created_at < now() - ($1::int * interval '1 day')",
        [policy.resolvedSecurityEventDays],
      );
      const notifications = await client.query(
        "delete from notifications where read_at is not null and created_at < now() - ($1::int * interval '1 day')",
        [policy.readNotificationDays],
      );
      await client.query(
        "update api_keys set is_active = false where is_active = true and expires_at is not null and expires_at <= now()",
      );
      const apiKeys = await client.query(
        "delete from api_keys where expires_at is not null and expires_at < now() - ($1::int * interval '1 day')",
        [policy.expiredApiKeyDays],
      );
      await client.query("commit");

      console.log(JSON.stringify({
        mode,
        database: actualDatabase,
        deactivatedExpiredSessions: deactivated.rowCount,
        deleted: {
          sessions: sessions.rowCount,
          loginAttempts: attempts.rowCount,
          resolvedSecurityEvents: securityEvents.rowCount,
          readNotifications: notifications.rowCount,
          expiredApiKeys: apiKeys.rowCount,
        },
      }, null, 2));
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
