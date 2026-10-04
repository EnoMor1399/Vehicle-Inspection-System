import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALLOWED_DEV_ADVISORIES = new Set([
  "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
]);

function runAudit(args) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const output = result.stdout || result.stderr || "{}";
  try {
    return JSON.parse(output);
  } catch {
    console.error(output);
    throw new Error("npm audit did not return valid JSON");
  }
}

function highOrCritical(report) {
  return Object.values(report.vulnerabilities || {}).filter(
    (item) => item && (item.severity === "high" || item.severity === "critical"),
  );
}

const productionReport = runAudit(["--omit=dev"]);
const productionBlockers = highOrCritical(productionReport);
if (productionBlockers.length) {
  console.error("Production dependency audit failed:");
  for (const item of productionBlockers) console.error(` - ${item.name}: ${item.severity}`);
  process.exit(1);
}

const fullReport = runAudit([]);
const vulnerabilities = fullReport.vulnerabilities || {};
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages = lock.packages || {};

function nodesAreDevOnly(item) {
  const nodes = Array.isArray(item.nodes) ? item.nodes : [];
  return nodes.length > 0 && nodes.every((node) => packages[node]?.dev === true);
}

function allowedByAdvisory(name, stack = new Set()) {
  if (stack.has(name)) return false;
  const item = vulnerabilities[name];
  if (!item) return false;

  const next = new Set(stack);
  next.add(name);

  const via = Array.isArray(item.via) ? item.via : [];
  if (!via.length) return false;

  return via.every((entry) => {
    if (typeof entry === "string") return allowedByAdvisory(entry, next);
    return ALLOWED_DEV_ADVISORIES.has(entry?.url);
  });
}

const devBlockers = highOrCritical(fullReport).filter(
  (item) => !(nodesAreDevOnly(item) && allowedByAdvisory(item.name)),
);

if (devBlockers.length) {
  console.error("Dependency audit failed on non-allowlisted high/critical findings:");
  for (const item of devBlockers) {
    console.error(` - ${item.name}: ${item.severity}`);
  }
  process.exit(1);
}

const allowed = highOrCritical(fullReport).filter(
  (item) => nodesAreDevOnly(item) && allowedByAdvisory(item.name),
);

if (allowed.length) {
  console.warn(
    `Allowed no-fix development advisory ${[...ALLOWED_DEV_ADVISORIES].join(", ")} across ${allowed.length} dev-only dependency nodes.`,
  );
}

console.log("Dependency audit passed: production has no high/critical findings and no unapproved dev high/critical findings.");
