import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

test("subscription checkout permissions are explicit, fail-closed and migrated before app upgrade", () => {
  const migration = read("migrations/20261025_super_admin_subscription_checkout_control.sql");
  const runner = read("scripts/apply-enterprise-upgrade.mjs");
  const schema = read("src/db/schema.ts");
  assert.match(migration, /ALTER TABLE organization_subscriptions/);
  assert.match(migration, /checkout_enabled boolean NOT NULL DEFAULT false/);
  assert.match(schema, /checkoutEnabled: boolean\("checkout_enabled"\)\.notNull\(\)\.default\(false\)/);
  assert.match(runner, /20261025_super_admin_subscription_checkout_control\.sql/);
});

test("only Organization Owners can initiate an approved subscription payment", () => {
  const action = read("src/app/organization/payments/actions.ts");
  const page = read("src/app/organization/payments/page.tsx");
  assert.match(action, /user\.role !== "organization_owner"/);
  assert.match(action, /!current\.subscription\.checkoutEnabled/);
  assert.match(action, /pg_advisory_xact_lock\(hashtext/);
  assert.match(action, /checkoutEnabled: organizationSubscriptions\.checkoutEnabled/);
  assert.match(action, /!bill\.checkoutEnabled/);
  assert.match(action, /bill\.organizationId !== user\.organizationId/);
  assert.match(action, /toGhsPesewas\(String\(bill\.amount\)\)/);
  assert.match(page, /subscription\.checkoutEnabled/);
  assert.match(page, /Super Admin has not approved online payment collection/);
});

test("Super Admin approval is audited, tenant-scoped, and independent from subscription status", () => {
  const action = read("src/app/platform/payments/actions.ts");
  const ui = read("src/app/platform/organizations/[id]/page.tsx");
  assert.match(action, /requirePlatformSuperAdmin\(\)/);
  assert.match(action, /action: "update"/);
  assert.match(action, /entityType: "subscription_checkout_control"/);
  assert.match(action, /required: true/);
  assert.match(action, /organizationSubscriptions\.organizationId, organizationId/);
  assert.match(action, /checkoutEnabled: enabled/);
  assert.match(action, /paymentsAvailable\(\)/);
  assert.match(ui, /setSubscriptionCheckoutAvailability/);
  assert.match(ui, /Pause new payments/);
  assert.match(ui, /Approve online payments/);
});

test("Super Admin re-verification never directly sets paid status or subscription entitlements", () => {
  const action = read("src/app/platform/payments/actions.ts");
  const dashboard = read("src/app/platform/payments/page.tsx");
  const provider = read("src/lib/paystack-payments.ts");
  assert.match(action, /verifyAndRecordPayment\(payment\.reference\)/);
  assert.match(action, /payment\.status !== "pending" && payment\.status !== "processing"/);
  assert.doesNotMatch(action, /status:\s*"success"/);
  assert.doesNotMatch(action, /\.update\(subscriptionPayments\)/);
  assert.match(provider, /matchesOriginalInvoice\(txn/);
  assert.match(provider, /pg_advisory_xact_lock/);
  assert.match(dashboard, /VerifyPaymentForm/);
  assert.match(dashboard, /Manage subscription/);
});


test("platform plan catalog pricing can only be changed by the Super Admin", () => {
  const actions = read("src/app/platform/payments/actions.ts");
  const pricing = read("src/app/platform/payments/PlanPricingForm.tsx");
  const dashboard = read("src/app/platform/payments/page.tsx");
  assert.match(actions, /export async function updateSubscriptionPlanPricing/);
  assert.match(actions, /const actor = await requirePlatformSuperAdmin\(\)/);
  assert.match(actions, /entityType: "platform_subscription_plan_pricing"/);
  assert.match(actions, /required: true/);
  assert.match(actions, /plan.currency !== "GHS"/);
  assert.match(actions, /db.update\(subscriptionPlans\)/);
  assert.doesNotMatch(actions, /\.update\(subscriptionPayments\)/);
  assert.match(pricing, /updateSubscriptionPlanPricing/);
  assert.match(dashboard, /Subscription plan catalog/);
});


test("Super Admin cannot reprice a subscription while a matching billing period is unresolved", () => {
  const service = read("src/lib/organization-control-plane.ts");
  assert.match(service, /const billingTermsChanged = planChanged/);
  assert.match(service, /subscription-payments:/);
  assert.match(service, /subscriptionPayments\.organizationId, input\.organizationId/);
  assert.match(service, /subscriptionPayments\.subscriptionId, current\.subscription\.id/);
  assert.match(service, /inArray\(subscriptionPayments\.status, \["pending", "processing"\]\)/);
  assert.match(service, /An unresolved subscription payment exists/);
});
