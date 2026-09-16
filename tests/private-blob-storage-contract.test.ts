import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("private Blob adapter uses private access and store-scoped authorization", () => {
  const source = readFileSync("src/lib/private-blob-storage.ts", "utf8");
  assert.match(source, /BLOB_READ_WRITE_TOKEN/);
  assert.match(source, /https:\/\/vercel\.com\/api\/blob/);
  assert.match(source, /x-vercel-blob-access/);
  assert.match(source, /"private"/);
  assert.match(source, /x-vercel-blob-store-id/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.match(source, /\.private\.blob\.vercel-storage\.com/);
});

test("private Blob adapter does not expose unsafe public-storage fallback", () => {
  const source = readFileSync("src/lib/private-blob-storage.ts", "utf8");
  assert.doesNotMatch(source, /x-vercel-blob-access": "public"/);
  assert.match(source, /Stored document URL is not an approved private Blob location/);
});
