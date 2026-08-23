import "dotenv/config";
import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { issueApiKey } from "@/lib/api-keys";

const [emailArg, scopesArg = "read", nameArg = "Integration Key"] = process.argv.slice(2);
if (!emailArg) {
  console.error('Usage: npm run api-key:create -- <user-email> <read,write,inspect|admin> "Key Name"');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const allowed = new Set(["read", "write", "inspect", "admin"]);
const scopes = scopesArg.split(",").map((value) => value.trim()).filter(Boolean);
if (!scopes.length || scopes.some((scope) => !allowed.has(scope))) {
  throw new Error("Scopes must be one or more of: read, write, inspect, admin");
}

const [user] = await db.select().from(users).where(eq(users.email, email));
if (!user || !user.isActive) throw new Error("Active user not found");

const issued = await issueApiKey({ userId: user.id, name: nameArg, scopes });
console.log("API key created. Copy it now; it will not be stored in plaintext:");
console.log(issued.raw);
await pool.end();
