import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || "";
const name = (process.env.SUPER_ADMIN_NAME || "").trim();
const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || "";
const mode = (process.env.REPAIR_MODE || "preview").trim().toLowerCase();
const confirmation = process.env.REPAIR_CONFIRMATION || "";
const securityAcknowledgement = process.env.REPAIR_SECURITY_ACK || "";
const expectedConfirmation = `REPAIR_ADMIN:${email}`;
const expectedSecurityAcknowledgement = "I_UNDERSTAND_THIS_RESETS_ADMIN_SECURITY_STATE";

function abort(message) {
  console.error(`Administrator repair aborted: ${message}`);
  process.exit(1);
}

function normalizeDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.get("sslmode") === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    abort("DATABASE_URL is invalid");
  }
}

if (!DATABASE_URL) abort("DATABASE_URL is required");
if (!name) abort("SUPER_ADMIN_NAME is required");
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) abort("SUPER_ADMIN_EMAIL is invalid");
if (!new Set(["preview", "execute"]).has(mode)) abort("REPAIR_MODE must be preview or execute");

if (mode === "execute") {
  if (!password) abort("SUPER_ADMIN_PASSWORD is required for execute mode");
  if (confirmation !== expectedConfirmation) abort("repair confirmation mismatch");
  if (securityAcknowledgement !== expectedSecurityAcknowledgement) abort("security-state acknowledgement mismatch");

  const requirements = [
    [password.length >= 12 && password.length <= 128, "must be 12-128 characters"],
    [/[A-Z]/.test(password), "must include an uppercase letter"],
    [/[a-z]/.test(password), "must include a lowercase letter"],
    [/[0-9]/.test(password), "must include a number"],
    [/[^A-Za-z0-9]/.test(password), "must include a special character"],
    [!/\s/.test(password), "must not contain whitespace"],
  ];
  const passwordErrors = requirements.filter(([valid]) => !valid).map(([, message]) => message);
  if (passwordErrors.length) abort(`password ${passwordErrors.join(", ")}`);
}

const client = new Client({ connectionString: normalizeDatabaseUrl(DATABASE_URL) });

try {
  await client.connect();

  const { rows: existingRows } = await client.query(
    `SELECT id, email, role, is_active, failed_login_attempts, locked_until
     FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );
  const existing = existingRows[0] || null;
  const { rows: sessionRows } = existing
    ? await client.query("SELECT count(*)::int AS count FROM sessions WHERE user_id = $1", [existing.id])
    : { rows: [{ count: 0 }] };

  if (mode === "preview") {
    console.log(JSON.stringify({
      mode: "preview",
      targetAdministrator: { name, email },
      accountExists: Boolean(existing),
      currentRole: existing?.role || null,
      currentlyActive: existing?.is_active || false,
      failedLoginAttempts: existing?.failed_login_attempts || 0,
      lockedUntil: existing?.locked_until || null,
      sessionsThatWouldBeRevoked: Number(sessionRows[0]?.count || 0),
      plannedChanges: [
        existing ? "reset credentials and security lockout state" : "create Super Administrator account",
        "set role to super_admin and grant full permissions",
        "revoke existing sessions",
      ],
      executed: false,
    }, null, 2));
  } else {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [78654221]);

    const rounds = Math.min(14, Math.max(10, Number(process.env.PASSWORD_BCRYPT_ROUNDS || 12)));
    const passwordHash = await bcrypt.hash(password, rounds);
    const id = existing?.id || crypto.randomUUID();

    if (existing) {
      await client.query(
        `UPDATE users SET name = $1, email = $2, role = 'super_admin',
           password_hash = $3, permissions = $4::jsonb, is_active = true,
           failed_login_attempts = 0, locked_until = NULL, updated_at = now()
         WHERE id = $5`,
        [name, email, passwordHash, JSON.stringify({ "*": true }), id]
      );
    } else {
      await client.query(
        `INSERT INTO users
          (id, name, email, role, password_hash, permissions, is_active,
           failed_login_attempts, two_factor_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, 'super_admin', $4, $5::jsonb, true, 0, false, now(), now())`,
        [id, name, email, passwordHash, JSON.stringify({ "*": true })]
      );
    }

    await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);

    const { rows: verifiedRows } = await client.query(
      `SELECT email, role, is_active, password_hash
       FROM users WHERE id = $1`,
      [id]
    );
    const verified = verifiedRows[0];
    const passwordMatches = Boolean(verified?.password_hash && await bcrypt.compare(password, verified.password_hash));
    if (!verified || verified.email !== email || verified.role !== "super_admin" || !verified.is_active || !passwordMatches) {
      throw new Error("post-repair administrator verification failed");
    }

    await client.query("COMMIT");
    console.log(JSON.stringify({
      mode: "execute",
      success: true,
      accountCreated: !existing,
      email,
      role: verified.role,
      isActive: verified.is_active,
      passwordVerified: passwordMatches,
      sessionsRevoked: true,
    }, null, 2));
  }
} catch (error) {
  if (mode === "execute") await client.query("ROLLBACK").catch(() => {});
  abort(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => {});
}
