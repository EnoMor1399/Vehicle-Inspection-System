import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || "";
const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const expectedPassword = process.env.SUPER_ADMIN_PASSWORD || "";

function fail(message) {
  throw new Error(`Administrator diagnosis aborted: ${message}`);
}

function normalizeDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.get("sslmode") === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    fail("DATABASE_URL is invalid");
  }
}

if (!DATABASE_URL) fail("DATABASE_URL is required");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("SUPER_ADMIN_EMAIL is invalid");
if (!expectedPassword) fail("SUPER_ADMIN_PASSWORD is required");

const client = new Client({ connectionString: normalizeDatabaseUrl(DATABASE_URL) });

try {
  await client.connect();
  const { rows: users } = await client.query(
    `SELECT id, email, role, is_active, password_hash,
            password_hash IS NOT NULL AS has_password,
            failed_login_attempts, locked_until
     FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const user = users[0];
  const passwordMatchesSecret = Boolean(
    user?.password_hash && (await bcrypt.compare(expectedPassword, user.password_hash))
  );

  const { rows: attempts } = await client.query(
    `SELECT success, failure_reason, created_at
     FROM login_attempts WHERE lower(email) = $1
     ORDER BY created_at DESC LIMIT 5`,
    [email]
  );

  const { rows: sessionRows } = user
    ? await client.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE is_active = true AND expires_at > now())::int AS active
         FROM sessions WHERE user_id = $1`,
        [user.id]
      )
    : { rows: [{ total: 0, active: 0 }] };

  console.log(JSON.stringify({
    accountExists: Boolean(user),
    email: user?.email || email,
    role: user?.role || null,
    isActive: user?.is_active || false,
    hasPassword: user?.has_password || false,
    passwordMatchesGitHubSecret: passwordMatchesSecret,
    failedLoginAttempts: user?.failed_login_attempts || 0,
    lockedUntil: user?.locked_until || null,
    sessions: {
      total: Number(sessionRows[0]?.total || 0),
      active: Number(sessionRows[0]?.active || 0),
    },
    recentLoginAttempts: attempts,
  }, null, 2));

  if (!user) process.exitCode = 2;
  else if (!passwordMatchesSecret) process.exitCode = 3;
  else if (!user.is_active || user.role !== "super_admin") process.exitCode = 4;
} finally {
  await client.end().catch(() => {});
}
