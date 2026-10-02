import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production deployment verification resolves the actual event before entering the protected job", () => {
  const workflow = readFileSync(".github/workflows/post-deploy-verification.yml", "utf8");
  const smoke = readFileSync("scripts/post-deploy-smoke.mjs", "utf8");

  assert.match(workflow, /deployment_status:/);
  assert.match(workflow, /name: Resolve production deployment/);
  assert.match(workflow, /GITHUB_EVENT_PATH/);
  assert.match(workflow, /git\/ref\/heads\/main/);
  assert.match(workflow, /deployment_status\?\.environment_url/);
  assert.match(workflow, /deployment_status\?\.target_url/);
  assert.match(workflow, /should_verify=\$\{shouldVerify\}/);
  assert.match(workflow, /needs: scope/);
  assert.match(workflow, /if: needs\.scope\.outputs\.should_verify == 'true'/);
  assert.match(workflow, /VIMS_BASE_URL: \$\{\{ needs\.scope\.outputs\.base_url \}\}/);
  assert.match(workflow, /if \[\[ "\$GITHUB_REF" != "refs\/heads\/main" \]\]/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);

  assert.doesNotMatch(workflow, /deployment\.environment == 'Production'/);
  assert.doesNotMatch(workflow, /deployment\.ref == 'main'/);

  assert.match(smoke, /x-vercel-protection-bypass/);
  assert.match(smoke, /x-vercel-set-bypass-cookie/);
  assert.match(smoke, /\/api\/health\/live/);
  assert.match(smoke, /\/api\/health/);
});
