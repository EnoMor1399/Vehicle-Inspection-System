import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isPublicNetworkAddress,
  validateResolvedAddresses,
  validateWebhookDestination,
} from "../src/lib/integration-security";
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

test("resolved webhook addresses must all be public network destinations", () => {
  assert.equal(isPublicNetworkAddress("8.8.8.8"), true);
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicNetworkAddress("127.0.0.1"), false);
  assert.equal(isPublicNetworkAddress("169.254.169.254"), false);
  assert.equal(isPublicNetworkAddress("fc00::1"), false);
  assert.equal(validateResolvedAddresses(["8.8.8.8", "1.1.1.1"]).ok, true);
  assert.equal(validateResolvedAddresses(["8.8.8.8", "10.0.0.8"]).ok, false);
  assert.equal(validateResolvedAddresses([]).ok, false);
});

test("webhook subscriptions accept only implemented documented events and strong optional secrets", () => {
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

  const unsupportedUserEvent = webhookCreateSchema.safeParse({
    url: "https://hooks.example.com/vims",
    events: ["user.created"],
  });
  assert.equal(unsupportedUserEvent.success, false);

  const weakSecret = webhookCreateSchema.safeParse({
    url: "https://hooks.example.com/vims",
    events: ["vehicle.created"],
    secret: "short",
  });
  assert.equal(weakSecret.success, false);
});

test("webhook route encrypts signing secrets and resolves destinations before persistence", () => {
  const source = readFileSync("src/app/api/v1/webhooks/route.ts", "utf8");
  assert.match(source, /secret:\s*encryptField\(signingSecret\)/);
  assert.match(source, /validateResolvedWebhookDestination\(destination\.url\)/);
  assert.match(source, /MAX_WEBHOOKS_PER_USER\s*=\s*20/);
});

test("delivery revalidates DNS, pins the validated address and signs timestamp plus body", () => {
  const source = readFileSync("src/lib/webhook-delivery.ts", "utf8");
  assert.match(source, /validateWebhookDestination\(target\.url\)/);
  assert.match(source, /validateResolvedWebhookDestination\(destination\.url\)/);
  assert.match(source, /hostname:\s*address/);
  assert.match(source, /servername:\s*url\.hostname/);
  assert.match(source, /Host:\s*url\.host/);
  assert.match(source, /createHmac\("sha256", secret\)/);
  assert.match(source, /`\$\{envelope\.timestamp\}\.\$\{body\}`/);
  assert.match(source, /"X-Webhook-Signature":\s*`sha256=\$\{signature\}`/);
  assert.match(source, /WEBHOOK_TIMEOUT_MS\s*=\s*5_000/);
  assert.doesNotMatch(source, /fetch\(/);
});

test("vehicle and inspection mutations emit only minimum-data documented events", () => {
  const vehicleApi = readFileSync("src/app/api/v1/vehicles/route.ts", "utf8");
  const vehicleItemApi = readFileSync("src/app/api/v1/vehicles/[id]/route.ts", "utf8");
  const vehicleAdmin = readFileSync("src/app/vehicles/server.ts", "utf8");
  const inspectionApi = readFileSync("src/app/api/v1/inspections/route.ts", "utf8");
  const inspectionAdmin = readFileSync("src/app/inspections/server.ts", "utf8");

  assert.match(vehicleApi, /emitWebhookEvent\("vehicle\.created"/);
  assert.match(vehicleItemApi, /emitWebhookEvent\("vehicle\.updated"/);
  assert.match(vehicleAdmin, /emitWebhookEvent\("vehicle\.created"/);
  assert.match(vehicleAdmin, /emitWebhookEvent\("vehicle\.updated"/);
  assert.match(inspectionApi, /"inspection\.failed"\s*:\s*"inspection\.completed"/);
  assert.match(inspectionAdmin, /"inspection\.failed"\s*:\s*"inspection\.completed"/);
});