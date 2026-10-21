import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const inspectionEmail = process.env.E2E_USER_EMAIL || "e2e.inspector@vims.local";
const inspectionPassword = process.env.E2E_USER_PASSWORD || "E2eOnly!Passw0rd2026";
const trainingEmail = process.env.E2E_TRAINING_USER_EMAIL || "e2e.training.admin@vims.local";
const trainingPassword = process.env.E2E_TRAINING_USER_PASSWORD || inspectionPassword;
const tenantInspectionEmail = process.env.E2E_TENANT_USER_EMAIL || "e2e.tenant.inspector@vims.local";
const tenantInspectionPassword = process.env.E2E_TENANT_USER_PASSWORD || inspectionPassword;
const tenantTrainingEmail = process.env.E2E_TENANT_TRAINING_USER_EMAIL || "e2e.tenant.training.admin@vims.local";
const tenantTrainingPassword = process.env.E2E_TENANT_TRAINING_USER_PASSWORD || inspectionPassword;
const rslVehicleId = "e2e0000-0000-4000-8000-000000000004";
const tenantVehicleId = "e2e10000-0000-4000-8000-000000000007";
const tenantOrganizationId = "e2e10000-0000-4000-8000-000000000001";
const rslOrganizationId = "00000000-0000-4000-8000-000000000101";

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  destination: "/" | "/driver-training",
) {
  await page.goto(`${baseURL}/login`);
  await expect(page.getByRole("button", { name: "Create Account" })).toHaveCount(0);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(`${baseURL}${destination}`);
}

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${baseURL}/login`);
}

test("Vehicle Inspection and Driver Training workspaces are isolated by account role", async ({ page }) => {
  await signIn(page, inspectionEmail, inspectionPassword, "/");
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();

  await page.goto(`${baseURL}/vehicles`);
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
  await expect(page.getByText("E2E-2026")).toBeVisible();

  await page.goto(`${baseURL}/inspections`);
  await expect(page.getByRole("heading", { name: "Vehicle Inspections" })).toBeVisible();
  await expect(page.getByText("E2E-INSP-001")).toBeVisible();

  // Vehicle Inspection users cannot open the Driver Training workspace.
  await page.goto(`${baseURL}/driver-training`);
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();

  await signOut(page);
  await signIn(page, trainingEmail, trainingPassword, "/driver-training");
  await expect(page.getByText("E2E-TRAIN-001")).toBeVisible();

  await page.goto(`${baseURL}/driver-training/assessments`);
  await expect(page.getByRole("heading", { name: "Driver Performance Assessment" })).toBeVisible();

  const driverSelect = page.locator('select[name="participantId"]');
  const e2eDriverOption = driverSelect.locator("option").filter({ hasText: "E2E Driver" });
  await expect(e2eDriverOption).toHaveCount(1);
  const e2eDriverId = await e2eDriverOption.getAttribute("value");
  expect(e2eDriverId).toBeTruthy();
  await driverSelect.selectOption(e2eDriverId!);
  await expect(driverSelect).toHaveValue(e2eDriverId!);

  // Driver Training administrators cannot open Vehicle Inspection operations.
  await page.goto(`${baseURL}/vehicles`);
  await page.waitForURL(`${baseURL}/driver-training`);
  await expect(page.getByText("E2E-TRAIN-001")).toBeVisible();
});


test("separate subscriber organizations cannot see each other's operational records", async ({ page }) => {
  await signIn(page, inspectionEmail, inspectionPassword, "/");

  // Platform governance must remain inaccessible to subscriber accounts.
  await page.goto(`${baseURL}/platform/oversight`);
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByText("Platform Oversight Centre")).toHaveCount(0);

  // The new scoped routes must be denied to ordinary organization users too.
  for (const restrictedPath of [
    `/platform/oversight/${tenantOrganizationId}`,
    `/platform/oversight/${tenantOrganizationId}/section/vehicles`,
    `/platform/oversight/${tenantOrganizationId}/section/inspections`,
  ]) {
    await page.goto(`${baseURL}${restrictedPath}`);
    await expect(page).toHaveURL(`${baseURL}/`);
  }

  await page.goto(`${baseURL}/vehicles`);
  await expect(page.getByText("E2E-2026")).toBeVisible();
  await expect(page.getByText("TENANT-2026")).toHaveCount(0);

  await page.goto(`${baseURL}/inspections`);
  await expect(page.getByText("E2E-INSP-001")).toBeVisible();
  await expect(page.getByText("TENANT-INSP-001")).toHaveCount(0);

  await expect(page.getByRole("link", { name: /Open notifications/ })).toBeVisible();
  await page.getByRole("link", { name: /Open notifications/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole("heading", { name: "E2E Platform Change Notice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E RSL-Only Alert" })).toBeVisible();
  await expect(page.getByText("E2E Tenant-Only Alert")).toHaveCount(0);
  await expect(page.getByText("E2E Future Scheduled Notice")).toHaveCount(0);

  // The Maintenance Risk page must not bypass tenant-scoped APIs through
  // its own server-side fleet and inspection-history queries.
  await page.goto(`${baseURL}/predictive`);
  await expect(page.getByRole("heading", { name: "Maintenance Risk Intelligence" })).toBeVisible();
  await expect(page.locator(`a[href="/vehicles/${rslVehicleId}"]`)).toHaveCount(1);
  await expect(page.locator(`a[href="/vehicles/${tenantVehicleId}"]`)).toHaveCount(0);

  const tenantVehicleResponse = await page.goto(`${baseURL}/vehicles/${tenantVehicleId}`);
  expect(tenantVehicleResponse?.status()).toBe(404);

  await signOut(page);
  await signIn(page, tenantInspectionEmail, tenantInspectionPassword, "/");

  await page.goto(`${baseURL}/vehicles`);
  await expect(page.getByText("TENANT-2026")).toBeVisible();
  await expect(page.getByText("E2E-2026")).toHaveCount(0);

  await page.goto(`${baseURL}/inspections`);
  await expect(page.getByText("TENANT-INSP-001")).toBeVisible();
  await expect(page.getByText("E2E-INSP-001")).toHaveCount(0);

  await page.goto(`${baseURL}/notifications`);
  await expect(page.getByRole("heading", { name: "E2E Platform Change Notice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E Tenant-Only Alert" })).toBeVisible();
  await expect(page.getByText("E2E RSL-Only Alert")).toHaveCount(0);
  await expect(page.getByText("E2E Future Scheduled Notice")).toHaveCount(0);

  await page.goto(`${baseURL}/predictive`);
  await expect(page.getByRole("heading", { name: "Maintenance Risk Intelligence" })).toBeVisible();
  await expect(page.locator(`a[href="/vehicles/${tenantVehicleId}"]`)).toHaveCount(1);
  await expect(page.locator(`a[href="/vehicles/${rslVehicleId}"]`)).toHaveCount(0);

  const rslVehicleResponse = await page.goto(`${baseURL}/vehicles/${rslVehicleId}`);
  expect(rslVehicleResponse?.status()).toBe(404);

  await signOut(page);
  await signIn(page, trainingEmail, trainingPassword, "/driver-training");
  await expect(page.getByText("E2E-TRAIN-001")).toBeVisible();
  await expect(page.getByText("TENANT-TRAIN-001")).toHaveCount(0);

  await signOut(page);
  await signIn(page, tenantTrainingEmail, tenantTrainingPassword, "/driver-training");
  await expect(page.getByText("TENANT-TRAIN-001")).toBeVisible();
  await expect(page.getByText("E2E-TRAIN-001")).toHaveCount(0);
});

test("mobile Vehicle Inspection pages do not introduce horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, inspectionEmail, inspectionPassword, "/");

  for (const pathname of ["/", "/inspections"]) {
    await page.goto(`${baseURL}${pathname}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});

test("mobile Driver Training pages remain responsive inside the training domain", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, trainingEmail, trainingPassword, "/driver-training");

  for (const pathname of ["/driver-training", "/driver-training/assessments"]) {
    await page.goto(`${baseURL}${pathname}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});

test("non-platform users cannot open the Super Administrator support centre", async ({ page }) => {
  await signIn(page, inspectionEmail, inspectionPassword, "/");
  await page.goto(`${baseURL}/platform/account-support`);
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();
  // Reuse this authenticated session to avoid false negatives from shared
  // login/MFA rate limits after the full E2E account-isolation suite.
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/support-session/start", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "e2e0000-0000-4000-8000-000000000004",
        reason: "Check an account's dashboard access",
        authenticationCode: "123456",
      }),
    });
    return { status: response.status, payload: await response.json() };
  });
  expect(result.status).toBe(403);
  expect(result.payload.error).toContain("Super Administrator");
  expect(JSON.stringify(result.payload)).not.toContain("Minified React error #441");

  const crossSite = await page.request.post(`${baseURL}/api/support-session/start`, {
    headers: { Origin: "https://malicious.invalid", "Content-Type": "application/json" },
    data: { userId: "any", reason: "Unauthorized account test", authenticationCode: "123456" },
  });
  expect(crossSite.status()).toBe(403);
  expect((await crossSite.json()).error).toContain("Cross-origin");
});

test("support-mode cookie blocks HTTP mutations even if no support record exists", async ({ page }) => {
  await signIn(page, inspectionEmail, inspectionPassword, "/");
  await page.context().addCookies([{
    name: "vims_support_token",
    value: "invalid-support-identity",
    url: baseURL,
    httpOnly: true,
    sameSite: "Strict",
  }]);
  const response = await page.request.post(`${baseURL}/api/auth/logout`, { data: {} });
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toContain("Read-only support mode");
});

test("Super Admin can activate selected company operations and create only company-owned records", async ({ page }) => {
  test.setTimeout(180_000);
  const { generate } = await import("otplib");
  const token = readFileSync(join(tmpdir(), "vims-e2e-super-admin-session"), "utf8").trim();
  await page.context().addCookies([{
    name: "rsl_session_token", value: token, url: baseURL,
    sameSite: "Lax", httpOnly: true, secure: false,
  }]);
  await page.goto(`${baseURL}/platform/oversight/${tenantOrganizationId}`);
  await page.getByRole("button", { name: "Enable organization operations" }).click();
  const modal = page.getByRole("dialog", { name: "Enable Super Admin organization operations" });
  await modal.locator("textarea").fill("Validate scoped tenant transporter creation in isolated browser tests");
  await modal.locator("input").nth(0).fill("OPERATE E2E Tenant Safety Ltd");
  await modal.locator("input").nth(1).fill(await generate({ secret: process.env.E2E_PLATFORM_TOTP_SEED || "" }));
  await modal.getByRole("button", { name: "Start secured organization operations" }).click();
  await expect(page.getByText("Super Admin operating in E2E Tenant Safety Ltd")).toBeVisible();
  await page.goto(`${baseURL}/transporters/new`);
  await page.locator('input[name="companyName"]').fill("E2E Scoped Operations Transporter");
  await page.getByRole("button", { name: "Create Transporter" }).click();
  await expect(page).toHaveURL(/\/transporters\/[^/]+$/);
  await page.getByRole("button", { name: "Exit company operations" }).click();
  await expect(page).toHaveURL(`${baseURL}/platform/oversight/${tenantOrganizationId}`);
  await page.goto(`${baseURL}/platform/oversight/${rslOrganizationId}/section/transporters`);
  await expect(page.getByText("E2E Scoped Operations Transporter")).toHaveCount(0);
});

test("signed-out Transporter Portal visitors are sent to login without a server error", async ({ page }) => {
  const response = await page.goto(`${baseURL}/portal`);
  expect(response?.status()).not.toBe(500);
  await expect(page).toHaveURL(`${baseURL}/login`);
  await expect(page.getByLabel("Email Address")).toBeVisible();
});

test("Vehicle Inspection Admin and Super Admin can use the real tenant-bound Transporter Portal", async ({ page }) => {
  test.setTimeout(180_000);

  const adminSession = readFileSync(join(tmpdir(), "vims-e2e-vehicle-admin-session"), "utf8").trim();
  await page.context().addCookies([{
    name: "rsl_session_token", value: adminSession,
    url: baseURL, sameSite: "Lax", httpOnly: true, secure: false,
  }]);
  await page.goto(`${baseURL}/`);
  const portalLink = page.getByRole("link", { name: "Transporter Portal", exact: true });
  await expect(portalLink).toHaveAttribute("href", "/portal");
  await portalLink.click();
  await expect(page.getByRole("heading", { name: "Transporter Portal Directory" })).toBeVisible();
  await expect(page.getByText("Tenant Transport Ltd").first()).toBeVisible();
  await expect(page.getByText("E2E Transport Ltd")).toHaveCount(0);

  const rslTransporterId = "e2e0000-0000-4000-8000-000000000003";
  const tenantTransporterId = "e2e10000-0000-4000-8000-000000000006";
  // Forging a transporter ID from another subscriber cannot cross the
  // authenticated Admin's tenant filter.
  await page.goto(`${baseURL}/portal?transporterId=${rslTransporterId}`);
  await expect(page.getByText("The selected transporter profile is unavailable.")).toBeVisible();
  await page.goto(`${baseURL}/portal?transporterId=${tenantTransporterId}`);
  await expect(page.getByRole("heading", { name: "Tenant Transport Ltd" })).toBeVisible();
  await expect(page.getByText("TENANT-2026").first()).toBeVisible();
  await expect(page.getByText("E2E-2026")).toHaveCount(0);

  await page.context().clearCookies();
  const superSession = readFileSync(join(tmpdir(), "vims-e2e-super-admin-session"), "utf8").trim();
  await page.context().addCookies([{
    name: "rsl_session_token", value: superSession,
    url: baseURL, sameSite: "Lax", httpOnly: true, secure: false,
  }]);

  const scoped = `${baseURL}/platform/oversight/${tenantOrganizationId}/section/transporter-portal`;
  await page.goto(scoped);
  await expect(page.getByRole("heading", { name: "Transporter Portal Directory" })).toBeVisible();
  await expect(page.getByText("Tenant Transport Ltd").first()).toBeVisible();
  await expect(page.getByText("E2E Transport Ltd")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Transporter Portal", exact: true }))
    .toHaveAttribute("href", `/platform/oversight/${tenantOrganizationId}/section/transporter-portal`);
  await page.goto(`${scoped}?transporterId=${tenantTransporterId}`);
  await expect(page.getByRole("heading", { name: "Tenant Transport Ltd" })).toBeVisible();
  await expect(page.getByText("TENANT-2026").first()).toBeVisible();
  await page.goto(`${scoped}?transporterId=${rslTransporterId}`);
  await expect(page.getByText("The selected transporter profile is unavailable.")).toBeVisible();

  await page.goto(`${baseURL}/platform/oversight/${rslOrganizationId}/section/transporter-portal`);
  await expect(page.getByRole("heading", { name: "Transporter Portal Directory" })).toBeVisible();
  await expect(page.getByText("E2E Transport Ltd").first()).toBeVisible();
  await expect(page.getByText("Tenant Transport Ltd")).toHaveCount(0);
});

test("Super Admin company switch and every operational sidebar destination return scoped content, not 404", async ({ page }) => {
  test.setTimeout(180_000); // Native VIMS pages render charts, analytics, and guarded records.
  // A test-only authenticated session from the isolated PostgreSQL seed avoids
  // consuming the suite's normal-user login rate limit or bypassing real auth.
  const sessionToken = readFileSync(join(tmpdir(), "vims-e2e-super-admin-session"), "utf8").trim();
  await page.context().addCookies([{
    name: "rsl_session_token", value: sessionToken,
    url: baseURL, sameSite: "Lax", httpOnly: true, secure: false,
  }]);
  await page.goto(`${baseURL}/platform/oversight/${tenantOrganizationId}`);
  const chooseOrganization = page.getByRole("button", { name: "Switch organization in the sidebar" });
  await expect(chooseOrganization).toBeVisible();
  await chooseOrganization.click();
  await page.getByRole("button", { name: /E2E Tenant Safety Ltd/ }).click();
  await expect(page).toHaveURL(`${baseURL}/platform/oversight/${tenantOrganizationId}`);
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable organization operations" })).toBeVisible();
  await page.getByRole("button", { name: "Enable organization operations" }).click();
  await expect(page.getByRole("dialog", { name: "Enable Super Admin organization operations" })).toBeVisible();
  await expect(page.getByText("OPERATE E2E Tenant Safety Ltd")).toBeVisible();
  await page.getByRole("button", { name: "Close authorization" }).click();
  await expect(page.getByRole("dialog", { name: "Enable Super Admin organization operations" })).toHaveCount(0);
  await expect(page.getByText("Core operating metrics")).toBeVisible();
  await expect(page.getByText("Inspection outcome trend")).toBeVisible();

  const vehiclesLink = page.getByRole("link", { name: "Vehicles", exact: true });
  await expect(vehiclesLink).toHaveAttribute("href",
    `/platform/oversight/${tenantOrganizationId}/section/vehicles`);
  await vehiclesLink.click();
  await expect(page).toHaveURL(
    `${baseURL}/platform/oversight/${tenantOrganizationId}/section/vehicles`);
  const vehiclesResponse = await page.goto(
    `${baseURL}/platform/oversight/${tenantOrganizationId}/section/vehicles`);
  const pageText = await page.locator("body").innerText();
  console.log("[scoped-navigation-e2e] Vehicles HTTP status:", vehiclesResponse?.status(),
    "Not Found:", pageText.includes("This page could not be found."));
  expect(vehiclesResponse?.status(), "Vehicles should render rather than 404/500").toBe(200);
  await expect(page.getByRole("heading", { name: "Vehicles", exact: true })).toBeVisible();
  await expect(page.getByText("Full organization asset inventory")).toBeVisible();
  await expect(page.getByRole("table").first().getByText("TENANT-2026")).toBeVisible();
  await expect(page.getByRole("table").first().getByText("E2E-2026")).toHaveCount(0);

  // Verifies valid server-side modules and the explicitly selected org for
  // every sidebar function, not just a link's href or a build-route manifest.
  for (const slug of [
    "transporters", "inspections", "daily-inspections", "scheduling",
    "stations", "training", "reports", "compliance", "maintenance-risk",
    "powerbi", "rfid", "users", "documents", "import-export",
    "settings", "audit", "notifications", "transporter-portal",
  ]) {
    const response = await page.goto(
      `${baseURL}/platform/oversight/${tenantOrganizationId}/section/${slug}`);
    expect(response?.status(), `Selected organization route ${slug}`).toBe(200);
    await expect(page.getByText("This page could not be found.")).toHaveCount(0);
    await expect(page.getByText("E2E Tenant Safety Ltd").first()).toBeVisible();
  }

  await chooseOrganization.click();
  await page.getByRole("button", { name: /Road Safety Limited/ }).click();
  await expect(page).toHaveURL(`${baseURL}/platform/oversight/${rslOrganizationId}`);
  await page.getByRole("link", { name: "Vehicles", exact: true }).click();
  await expect(page.getByRole("table").first().getByText("E2E-2026")).toBeVisible();
  await expect(page.getByRole("table").first().getByText("TENANT-2026")).toHaveCount(0);
});



