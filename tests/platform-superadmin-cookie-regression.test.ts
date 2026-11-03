import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPlatformControlPlaneRequest } from "../src/lib/platform-control-plane-request";

const read = (file: string) => readFileSync(file, "utf8");

test("platform routes remain available to the real Super Admin during a scoped operating session", () => {
  for (const path of [
    "/platform/organizations", "/platform/organizations/11111111-1111-4111-8111-111111111111",
    "/platform/oversight", "/platform/payments",
  ]) {
    assert.equal(isPlatformControlPlaneRequest(path, "GET"), true);
    assert.equal(isPlatformControlPlaneRequest(path, "POST"), true);
  }
  assert.equal(isPlatformControlPlaneRequest("/platform/operations-expired", "GET"), false);
  for (const path of ["/organization/account", "/users", "/vehicles", "/api/platform/operations/end"]) {
    assert.equal(isPlatformControlPlaneRequest(path, "GET"), false);
  }
  assert.equal(isPlatformControlPlaneRequest("/platform/organizations", "DELETE"), false);
  assert.equal(isPlatformControlPlaneRequest(null, "GET"), false);
});

test("platform auth uses the genuine actor and does not treat scope as a permission grant", () => {
  for (const path of ["src/lib/auth.ts", "src/lib/require-auth.ts"]) {
    const source = read(path);
    assert.match(source, /effective\.user\.role === "super_admin"/);
    assert.match(source, /!effective\.support/);
    assert.match(source, /isPlatformControlPlaneRequest/);
    assert.match(source, /return effective\.user/);
    assert.match(source, /operationalUserForRequest\(/);
  }
  const auth = read("src/lib/require-auth.ts");
  assert.match(auth, /const user = await requireAuth\(\)/);
  assert.match(auth, /if \(user\.role !== "super_admin"\) redirect\("\/"\)/);
  assert.doesNotMatch(auth, /throw new Error\("Exit scoped company operations before platform administration"\)/);
  const operations = read("src/lib/super-admin-operations-token.ts");
  assert.match(operations, /"\/platform\/organizations"/);
  assert.match(operations, /isAuthorizedOperationPage\(pathname\)/);
});
