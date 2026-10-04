import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("dependency audit blocks production findings and only allowlists the exact no-fix dev advisory", () => {
  const script = readFileSync("scripts/dependency-audit.mjs", "utf8");
  const quality = readFileSync(".github/workflows/quality-gate.yml", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  assert.match(script, /--omit=dev/);
  assert.match(script, /GHSA-vfj7-8cjw-p6xm/);
  assert.match(script, /nodesAreDevOnly/);
  assert.match(script, /high.*critical|critical.*high/);
  assert.match(script, /process\.exit\(1\)/);
  assert.match(quality, /npm run security:audit/);
  assert.equal(pkg.overrides.esbuild, "0.28.2");
});
