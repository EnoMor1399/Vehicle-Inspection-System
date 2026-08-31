import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const MAX_FILE_BYTES = 1_000_000;
const binaryExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".xlsx", ".xls", ".woff", ".woff2", ".ttf", ".eot",
]);

const detectors = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "GitHub token", regex: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "OpenAI-style secret", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  {
    name: "credentialed database URL",
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s/@]+:[^@\s/]+@[^\s'"`]+/gi,
  },
];

function isSafeExample(file, match) {
  if (file === ".env.example") return true;
  const lower = match.toLowerCase();
  return lower.includes("localhost")
    || lower.includes("127.0.0.1")
    || lower.includes("example")
    || lower.includes("replace-with")
    || lower.includes("secure_password")
    || lower.includes("<password>")
    || lower.includes("${");
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const findings = [];

for (const file of tracked) {
  if (/^\.env(?:\..+)?$/.test(file) && file !== ".env.example") {
    findings.push({ file, line: 1, detector: "tracked environment file" });
    continue;
  }
  if (/\.(?:pem|key|p12|pfx)$/i.test(file) || /(?:^|\/)(?:id_rsa|id_ed25519)$/i.test(file)) {
    findings.push({ file, line: 1, detector: "tracked private-key material" });
    continue;
  }
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;

  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > MAX_FILE_BYTES) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const detector of detectors) {
    detector.regex.lastIndex = 0;
    let match;
    while ((match = detector.regex.exec(content)) !== null) {
      if (isSafeExample(file, match[0])) continue;
      findings.push({ file, line: lineNumber(content, match.index), detector: detector.name });
    }
  }
}

if (findings.length) {
  console.error("Potential committed secrets detected. Values are intentionally not printed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.detector})`);
  }
  process.exit(1);
}

console.log(`Secret scan passed across ${tracked.length} tracked files.`);
