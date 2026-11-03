import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("public VIMS landing remains accessible without a login and does not replace the signed-in dashboard", () => {
  const root = read("src/app/page.tsx");
  const shell = read("src/components/AppShell.tsx");
  const welcome = read("src/app/welcome/page.tsx");
  assert.match(root, /validateSession\(sessionToken\)/);
  assert.match(root, /requireVehicleInspectionUser\(\)/);
  assert.match(root, /ExecutiveDashboardView organizationId=\{user\.organizationId\}/);
  assert.match(root, /listSubscriptionPlans\(\)/);
  assert.match(root, /VimsLandingPage plans=\{plans\}/);
  assert.match(shell, /!userRole && pathname === "\/"/);
  assert.match(shell, /"\/welcome"/);
  assert.match(welcome, /listSubscriptionPlans\(\)/);
  assert.match(welcome, /VimsLandingPage plans=\{plans\}/);
});

test("landing cards use active subscription plan limits, modules, cycle, currency and prices without fabricated pricing", () => {
  const view = read("src/components/marketing/VimsLandingPage.tsx");
  const plans = read("src/lib/organization-control-plane.ts");
  assert.match(plans, /eq\(subscriptionPlans\.isActive, true\)/);
  assert.match(view, /plan\.price/);
  assert.match(view, /plan\.currency/);
  assert.match(view, /plan\.billingCycle/);
  assert.match(view, /plan\.maxUsers/);
  assert.match(view, /plan\.maxStations/);
  assert.match(view, /plan\.maxVehicles/);
  assert.match(view, /plan\.maxInspectionsPerMonth/);
  assert.match(view, /plan\.modules\.includes/);
  assert.match(view, /plan\.trialDays/);
  assert.match(view, /Custom quote/);
  assert.doesNotMatch(view, /GH₵50|GH₵120|\$50\.00|\$120\.00/);
  assert.match(view, /\/subscribe\?plan=/);
});

test("subscription CTA preselects only a valid active plan and retains review-based onboarding", () => {
  const page = read("src/app/subscribe/page.tsx");
  const form = read("src/app/subscribe/SubscribeForm.tsx");
  const action = read("src/app/subscribe/actions.ts");
  const landing = read("src/components/marketing/VimsLandingPage.tsx");
  assert.match(page, /initialPlanCode=\{requestedCode\}/);
  assert.match(form, /plans\.some\(\(plan\) => plan\.code === initialPlanCode\)/);
  assert.match(action, /createOnboardingRequest\(/);
  assert.match(landing, /no payment is collected on this page/);
  assert.match(landing, /subject to administrative approval/);
  assert.match(landing, /href="\/login"/);
});

test("landing page is responsive and provides reachable public navigation, benefits and FAQs", () => {
  const landing = read("src/components/marketing/VimsLandingPage.tsx");
  for (const section of ["benefits", "workflow", "pricing", "faq"]) {
    assert.match(landing, new RegExp(`id="${section}"`));
  }
  assert.match(landing, /aria-label="Mobile landing page"/);
  assert.match(landing, /sm:px-10/);
  assert.match(landing, /lg:grid-cols-3/);
  assert.match(landing, /<details/);
  assert.match(landing, /Illustrative interface/);
});

test("landing follows the supplied pricing-first design and keeps billing quotes honest", () => {
  const landing = read("src/components/marketing/VimsLandingPage.tsx");
  assert.match(landing, /bg-\[#141414\]/);
  assert.match(landing, /Pricing plans/);
  assert.match(landing, /Annual pricing/);
  assert.match(landing, /Monthly pricing/);
  assert.match(landing, /aria-pressed=\{billingView === "annual"\}/);
  assert.match(landing, /billingView === "monthly"/);
  assert.match(landing, /comparison\.map/);
  assert.match(landing, /Subscription feature comparison/);
  assert.match(landing, /role="region"/);
  assert.match(landing, /Organisation & security/);
  assert.match(landing, /Priority support/);
  assert.match(landing, /if \(plan\.billingCycle === period && value > 0/);
  assert.match(landing, /Annual terms on request/);
  assert.match(landing, /&billing=annual/);
  assert.match(landing, /<FooterColumn/);
});

test("annual plan selection flows through the onboarding request without charging", () => {
  const page = read("src/app/subscribe/page.tsx");
  const form = read("src/app/subscribe/SubscribeForm.tsx");
  const action = read("src/app/subscribe/actions.ts");
  assert.match(page, /const annualQuote = params\.billing === "annual"/);
  assert.match(page, /initialBillingMode=\{annualQuote \? "annual" : "monthly"\}/);
  assert.match(form, /name="requestedBillingCycle"/);
  assert.match(action, /Annual billing quote requested/);
  assert.match(action, /createOnboardingRequest\(/);
});
