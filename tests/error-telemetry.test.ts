import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("frontend error endpoint uses the bounded streaming JSON reader", () => {
  const source = readFileSync("src/app/api/errors/route.ts", "utf8");
  assert.match(source, /API_SMALL_JSON_BODY_LIMIT, readJsonBody/);
  assert.match(source, /readJsonBody\(request, API_SMALL_JSON_BODY_LIMIT\)/);
  assert.doesNotMatch(source, /request\.json\(\)/);
  assert.doesNotMatch(source, /function payloadTooLarge/);
});

test("ErrorBoundary payload matches the strict telemetry schema", () => {
  const source = readFileSync("src/components/ErrorBoundary.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/errors"/);
  assert.match(source, /keepalive: true/);
  assert.doesNotMatch(source, /navigator\.userAgent/);
  assert.doesNotMatch(source, /userAgent:\s*navigator/);
});

test("ErrorBoundary internal recovery navigation uses a link instead of location assignment", () => {
  const source = readFileSync("src/components/ErrorBoundary.tsx", "utf8");
  assert.match(source, /<a\s+[\s\S]*href="\/"/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*["']\/["']/);
});
