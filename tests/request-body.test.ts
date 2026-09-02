import test from "node:test";
import assert from "node:assert/strict";
import { readJsonBody } from "../src/lib/request-body";

test("bounded JSON reader accepts valid bodies and reports byte size", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ registration_number: "GT-1" }),
  });

  const result = await readJsonBody(request, 1024);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, { registration_number: "GT-1" });
    assert.ok(result.bytes > 0);
    assert.ok(result.bytes < 1024);
  }
});

test("bounded JSON reader rejects malformed JSON without throwing", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    body: "{not-json",
  });

  const result = await readJsonBody(request, 1024);
  assert.deepEqual(result, { ok: false, status: 400, message: "Malformed JSON request body" });
});

test("bounded JSON reader rejects invalid and oversized Content-Length declarations", async () => {
  const invalid = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-length": "NaN" },
    body: "{}",
  });
  assert.deepEqual(await readJsonBody(invalid, 1024), {
    ok: false,
    status: 400,
    message: "Invalid Content-Length header",
  });

  const oversized = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-length": "4096" },
    body: "{}",
  });
  assert.deepEqual(await readJsonBody(oversized, 1024), {
    ok: false,
    status: 413,
    message: "Request body is too large",
  });
});

test("bounded JSON reader stops oversized streamed bodies even without Content-Length", async () => {
  const request = new Request("http://localhost/test", {
    method: "POST",
    body: JSON.stringify({ value: "x".repeat(4096) }),
  });

  const result = await readJsonBody(request, 512);
  assert.deepEqual(result, { ok: false, status: 413, message: "Request body is too large" });
});

test("bounded JSON reader rejects an empty body", async () => {
  const request = new Request("http://localhost/test", { method: "POST" });
  assert.deepEqual(await readJsonBody(request, 1024), {
    ok: false,
    status: 400,
    message: "JSON request body is required",
  });
});
