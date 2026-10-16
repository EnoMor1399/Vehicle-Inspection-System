import { test, expect } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const inspectionEmail = process.env.E2E_USER_EMAIL || "e2e.inspector@vims.local";
const inspectionPassword = process.env.E2E_USER_PASSWORD || "E2eOnly!Passw0rd2026";
const trainingEmail = process.env.E2E_TRAINING_USER_EMAIL || "e2e.training.admin@vims.local";
const trainingPassword = process.env.E2E_TRAINING_USER_PASSWORD || inspectionPassword;

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
