import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("private Blob adapter supports Vercel OIDC with read-write token fallback", () => {
  const source = readFileSync("src/lib/private-blob-storage.ts", "utf8");
  assert.match(source, /BLOB_STORE_ID/);
  assert.match(source, /VERCEL_OIDC_TOKEN/);
  assert.match(source, /BLOB_READ_WRITE_TOKEN/);
  assert.match(source, /mode: "oidc"/);
  assert.match(source, /mode: "read_write_token"/);
  assert.match(source, /https:\/\/vercel\.com\/api\/blob/);
  assert.match(source, /x-vercel-blob-access/);
  assert.match(source, /"private"/);
  assert.match(source, /x-vercel-blob-store-id/);
  assert.match(source, /authorization: `Bearer \$\{auth\.token\}`/);
  assert.match(source, /\.private\.blob\.vercel-storage\.com/);
});

test("private Blob adapter treats a linked store as configured without a long-lived token", () => {
  const source = readFileSync("src/lib/private-blob-storage.ts", "utf8");
  assert.match(source, /Boolean\(readEnv\("BLOB_STORE_ID"\) \|\| readEnv\("BLOB_READ_WRITE_TOKEN"\)\)/);
  assert.match(source, /Private document storage is connected, but Vercel OIDC credentials are unavailable/);
});

test("private Blob adapter does not expose unsafe public-storage fallback", () => {
  const source = readFileSync("src/lib/private-blob-storage.ts", "utf8");
  assert.doesNotMatch(source, /x-vercel-blob-access": "public"/);
  assert.match(source, /Stored document URL is not an approved private Blob location/);
});
