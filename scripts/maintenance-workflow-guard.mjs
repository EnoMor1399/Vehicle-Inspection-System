import { readFileSync } from "node:fs";

const productionWorkflows = [
  ".github/workflows/production-cutover.yml",
  ".github/workflows/production-db-upgrade.yml",
  ".github/workflows/repair-production-super-admin.yml",
  ".github/workflows/diagnose-super-admin-login.yml",
];

const allWorkflows = [
  ...productionWorkflows,
  ".github/workflows/quality-gate.yml",
];

const maintenanceScripts = [
  "scripts/reset-production-data.mjs",
  "scripts/repair-production-super-admin.mjs",
  "scripts/diagnose-super-admin-login.mjs",
];

const issues = [];

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    issues.push(`${path}: unable to read (${error instanceof Error ? error.message : String(error)})`);
    return "";
  }
}

function requireText(path, content, expected, message) {
  if (!content.includes(expected)) issues.push(`${path}: ${message}`);
}

for (const path of allWorkflows) {
  const content = read(path);
  if (!content) continue;

  if (/pull_request_target\s*:/.test(content)) {
    issues.push(`${path}: pull_request_target is not allowed for VIMS workflows`);
  }

  for (const match of content.matchAll(/uses:\s*([^\s#]+)/g)) {
    const actionRef = match[1];
    if (actionRef.startsWith("./")) continue;
    if (!/@[0-9a-f]{40}$/.test(actionRef)) {
      issues.push(`${path}: action reference must be pinned to a full 40-character commit SHA (${actionRef})`);
    }
  }
}

for (const path of productionWorkflows) {
  const content = read(path);
  if (!content) continue;

  requireText(
    path,
    content,
    'if [[ "$GITHUB_REF" != "refs/heads/main" ]]',
    "production workflow must refuse non-main refs"
  );
  requireText(path, content, "environment: production", "production workflow must use the production environment");
  requireText(path, content, "permissions:\n  contents: read", "production workflow must keep contents permission read-only");

  if (/\n\s{2}(?:push|pull_request|schedule):/.test(content)) {
    issues.push(`${path}: production maintenance workflow must remain workflow_dispatch-only`);
  }

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(SUPER_ADMIN_NAME|SUPER_ADMIN_EMAIL):\s*(.+?)\s*$/);
    if (match && !match[2].startsWith("${{")) {
      issues.push(`${path}: ${match[1]} must come from an explicit workflow expression, not a hardcoded value`);
    }
  }
}

for (const path of maintenanceScripts) {
  const content = read(path);
  if (!content) continue;

  if (/process\.env\.SUPER_ADMIN_(?:NAME|EMAIL)\s*\|\|\s*["'][^"']+["']/.test(content)) {
    issues.push(`${path}: administrator identity must not have a script-side fallback`);
  }
  requireText(path, content, 'url.searchParams.set("sslmode", "verify-full")', "database TLS must normalize sslmode=require to verify-full");
}

const cutover = read(".github/workflows/production-cutover.yml");
requireText(".github/workflows/production-cutover.yml", cutover, "CUTOVER_MODE: preview", "cutover must run a preview before execution");
requireText(".github/workflows/production-cutover.yml", cutover, "destructive_acknowledgement", "cutover must require a second destructive acknowledgement");
requireText(".github/workflows/production-cutover.yml", cutover, "I_UNDERSTAND_THIS_DELETES_OPERATIONAL_DATA", "cutover acknowledgement phrase is missing");

const repair = read(".github/workflows/repair-production-super-admin.yml");
requireText(".github/workflows/repair-production-super-admin.yml", repair, "REPAIR_MODE: preview", "administrator repair must run a preview before execution");
requireText(".github/workflows/repair-production-super-admin.yml", repair, "security_acknowledgement", "administrator repair must require a second security-state acknowledgement");

const dbUpgrade = read(".github/workflows/production-db-upgrade.yml");
requireText(".github/workflows/production-db-upgrade.yml", dbUpgrade, "/api/health/live", "database upgrade must verify application liveness");
requireText(".github/workflows/production-db-upgrade.yml", dbUpgrade, 'body?.status === "healthy"', "database upgrade must require explicit healthy readiness after migrations");

const qualityGate = read(".github/workflows/quality-gate.yml");
requireText(".github/workflows/quality-gate.yml", qualityGate, "node scripts/maintenance-workflow-guard.mjs", "quality gate must enforce maintenance workflow safeguards");

if (issues.length) {
  console.error("Maintenance workflow safeguard check failed:");
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

console.log(`Maintenance workflow safeguards passed for ${productionWorkflows.length} production workflows and ${maintenanceScripts.length} maintenance scripts.`);
