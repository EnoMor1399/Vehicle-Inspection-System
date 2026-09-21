import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production deployment verification is automatic and protection-aware", () => {
  const workflow = readFileSync(".github/workflows/post-deploy-verification.yml", "utf8");
  const smoke = readFileSync("scripts/post-deploy-smoke.mjs", "utf8");

  assert.match(workflow, /deployment_status:/);
  assert.match(workflow, /deployment_status\.state == 'success'/);
  assert.match(workflow, /deployment\.ref == 'main'/);
  assert.match(workflow, /environment_url/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(smoke, /x-vercel-protection-bypass/);
  assert.match(smoke, /x-vercel-set-bypass-cookie/);
  assert.match(smoke, /\/api\/health\/live/);
  assert.match(smoke, /\/api\/health/);
});
