import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateWebhookDestination } from "../src/lib/integration-security";
import { webhookCreateSchema } from "../src/lib/api-schemas";

const blockedDestinations = [
  "https://localhost/hook",
  "https://metadata.google.internal/computeMetadata/v1/",
  "https://10.0.0.1/hook",
  "https://100.64.0.1/hook",
  "https://169.254.169.254/latest/meta-data/",
  "https://192.168.1.1/hook",
  "https://[::1]/hook",
  "https://[fc00::1]/hook",
  "https://[febf::1]/hook",
  "https://[::ffff:127.0.0.1]/hook",
  "https://user:password@example.com/hook",
];

test("webhook destinations reject local, metadata, private and credentialed targets", () => {
  for (const destination of blockedDestinations) {
    const result = validateWebhookDestination(destination);
    assert.equal(result.ok, false, destination);
  }
});

test("webhook destination accepts public HTTPS and removes fragments", () => {
  const result = validateWebhookDestination("https://hooks.example.com:8443/vims?tenant=1#client-only");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url.hash, "");
    assert.equal(result.url.hostname, "hooks.example.com");
  }
});

test("webhook subscriptions accept only documented events and strong optional secrets", () => {
  const valid = webhookCreateSchema.safeParse({
    url: "https://hooks.example.com/vims",
    events: ["vehicle.created", "inspection.completed"],
    secret: "a-strong-webhook-secret-value-2026",
  });
  assert.equal(valid.success, true);

  const unknownEvent = webhookCreateSchema.safeParse({
    url: "https://hooks.example.com/vims",
    events: ["arbitrary.event"],
  });
  assert.equal(unknownEvent.success, false);

  const weakSecret = webhookCreateSchema.safeParse({
    url: "https://hooks.example.com/vims",
    events: ["vehicle.created"],
    secret: "short",
  });
  assert.equal(weakSecret.success, false);
});

test("webhook route encrypts signing secrets before persistence", () => {
  const source = readFileSync("src/app/api/v1/webhooks/route.ts", "utf8");
  assert.match(source, /secret:\s*encryptField\(signingSecret\)/);
  assert.match(source, /MAX_WEBHOOKS_PER_USER\s*=\s*20/);
});
