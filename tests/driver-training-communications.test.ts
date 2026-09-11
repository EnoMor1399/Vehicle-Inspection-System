import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canTransitionTrainingMessage,
  channelHasConsent,
  communicationPreferenceWarning,
  messageCanQueue,
  normalizeTrainingRecipient,
  trainingMessageCreateSchema,
} from "../src/lib/training-communication-policy";

const allowedPreference = {
  emailOptIn: true,
  smsOptIn: false,
  whatsappOptIn: true,
  doNotContact: false,
};

test("communication consent is channel specific and do-not-contact overrides every channel", () => {
  assert.equal(channelHasConsent(allowedPreference, "email"), true);
  assert.equal(channelHasConsent(allowedPreference, "sms"), false);
  assert.equal(channelHasConsent(allowedPreference, "whatsapp"), true);
  assert.equal(channelHasConsent({ ...allowedPreference, doNotContact: true }, "email"), false);
});

test("recipient normalization uses email for email and phone for SMS or WhatsApp", () => {
  assert.equal(normalizeTrainingRecipient("email", { email: " Person@Example.COM ", phone: "0240000000" }), "person@example.com");
  assert.equal(normalizeTrainingRecipient("sms", { email: "person@example.com", phone: " 0240000000 " }), "0240000000");
  assert.equal(normalizeTrainingRecipient("whatsapp", { phone: "0240000000" }), "0240000000");
});

test("message creation validates supported channels and bounded message body", () => {
  const base = {
    participantId: "d34db33f-0000-4000-8000-000000000090",
    messageType: "session_reminder",
    channel: "email",
    body: "Training reminder",
  };
  assert.equal(trainingMessageCreateSchema.safeParse(base).success, true);
  assert.equal(trainingMessageCreateSchema.safeParse({ ...base, channel: "telegram" }).success, false);
  assert.equal(trainingMessageCreateSchema.safeParse({ ...base, body: "" }).success, false);
});

test("queue eligibility requires approved state, current destination and current consent", () => {
  assert.equal(messageCanQueue({ status: "approved", channel: "email", recipientAddress: "person@example.com", preference: allowedPreference }), true);
  assert.equal(messageCanQueue({ status: "draft", channel: "email", recipientAddress: "person@example.com", preference: allowedPreference }), false);
  assert.equal(messageCanQueue({ status: "approved", channel: "sms", recipientAddress: "0240000000", preference: allowedPreference }), false);
  assert.equal(messageCanQueue({ status: "approved", channel: "email", recipientAddress: null, preference: allowedPreference }), false);
});

test("communication warnings explain missing preference, do-not-contact and missing channel consent", () => {
  assert.match(communicationPreferenceWarning({ channel: "email", recipientAddress: "person@example.com", preference: undefined }) || "", /No communication preference/);
  assert.match(communicationPreferenceWarning({ channel: "email", recipientAddress: "person@example.com", preference: { ...allowedPreference, doNotContact: true } }) || "", /do not contact/);
  assert.match(communicationPreferenceWarning({ channel: "sms", recipientAddress: "0240000000", preference: allowedPreference }) || "", /not opted in/);
});

test("outbound message lifecycle does not expose a manager transition to sent or failed", () => {
  assert.equal(canTransitionTrainingMessage("draft", "approved"), true);
  assert.equal(canTransitionTrainingMessage("approved", "queued"), true);
  assert.equal(canTransitionTrainingMessage("queued", "sent"), false);
  assert.equal(canTransitionTrainingMessage("queued", "failed"), false);
  assert.equal(canTransitionTrainingMessage("queued", "cancelled"), true);
});

test("communication actions use advisory locks and revalidate current participant consent before queueing", () => {
  const source = readFileSync("src/app/driver-training/communications/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /communicationPreferenceWarning/);
  assert.match(source, /messageCanQueue/);
  assert.match(source, /normalizeTrainingRecipient/);
  assert.match(source, /prepareTrainingSessionReminderDrafts/);
  assert.match(source, /prepareTrainingCertificateExpiryDrafts/);
  assert.match(source, /status: "draft"/);
  assert.doesNotMatch(source, /status: "sent"/);
});

test("communication migration rechecks current consent and current contact at queue time", () => {
  const migration = readFileSync("migrations/20260911_driver_training_communications.sql", "utf8");
  assert.match(migration, /training_comm_pref_participant_uidx/);
  assert.match(migration, /training_comm_pref_dnc_chk/);
  assert.match(migration, /enforce_training_message_queue_consent/);
  assert.match(migration, /NEW\.status = 'queued'/);
  assert.match(migration, /pref\.do_not_contact/);
  assert.match(migration, /pref\.email_opt_in/);
  assert.match(migration, /pref\.sms_opt_in/);
  assert.match(migration, /pref\.whatsapp_opt_in/);
  assert.match(migration, /must match the participant current email address/);
  assert.match(migration, /must match the participant current phone number/);
});

test("enterprise migration runner and verifier include communication objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_communications\.sql/);
  assert.match(verifier, /training_communication_preferences/);
  assert.match(verifier, /training_outbound_messages/);
  assert.match(verifier, /training_communication_events/);
  assert.match(verifier, /training_outbound_queue_idx/);
});

test("Driver Training navigation exposes Communications and workspace states no automatic external dispatch", () => {
  const layout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/communications/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/communications/);
  assert.match(page, /Training Communications & Reminders/);
  assert.match(page, /does not dispatch external messages by itself/);
  assert.match(page, /future external delivery integration/);
  assert.doesNotMatch(page, /Mark sent/);
});
