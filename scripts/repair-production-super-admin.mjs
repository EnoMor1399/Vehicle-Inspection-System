import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;
const name = (process.env.SUPER_ADMIN_NAME || "Enoch Morgan").trim();
const email = (process.env.SUPER_ADMIN_EMAIL || "morganenoch1@gmail.com").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || "";
const confirmation = process.env.REPAIR_CONFIRMATION || "";
const expectedConfirmation = `REPAIR_ADMIN:${email}`;

function abort(message) {
  console.error(`Administrator repair aborted: ${message}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) abort("DATABASE_URL is required");
if (!password) abort("SUPER_ADMIN_PASSWORD is required");
if (confirmation !== expectedConfirmation) abort(`expected confirmation ${expectedConfirmation}`);

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

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1)", [78654221]);

  const rounds = Math.min(14, Math.max(10, Number(process.env.PASSWORD_BCRYPT_ROUNDS || 12)));
  const passwordHash = await bcrypt.hash(password, rounds);
  const { rows: existingRows } = await client.query(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email]
  );
  const id = existingRows[0]?.id || crypto.randomUUID();

  if (existingRows[0]) {
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
    success: true,
    accountCreated: !existingRows[0],
    email,
    role: verified.role,
    isActive: verified.is_active,
    passwordVerified: passwordMatches,
    sessionsRevoked: true,
  }, null, 2));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  abort(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => {});
}
