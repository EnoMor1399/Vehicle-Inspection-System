import { test, expect } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const email = process.env.E2E_USER_EMAIL || "e2e.inspector@vims.local";
const password = process.env.E2E_USER_PASSWORD || "E2eOnly!Passw0rd2026";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto(`${baseURL}/login`);
  await expect(page.getByRole("button", { name: "Create Account" })).toHaveCount(0);
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: "Executive Dashboard" })).toBeVisible();
}

test("authenticated inspection and training workspaces load from a real database", async ({ page }) => {
  await signIn(page);

  await page.goto(`${baseURL}/vehicles`);
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
  await expect(page.getByText("E2E-2026")).toBeVisible();

  await page.goto(`${baseURL}/inspections`);
  await expect(page.getByRole("heading", { name: "Vehicle Inspections" })).toBeVisible();
  await expect(page.getByText("E2E-INSP-001")).toBeVisible();

  await page.goto(`${baseURL}/driver-training`);
  await expect(page.getByText("E2E-TRAIN-001")).toBeVisible();

  await page.goto(`${baseURL}/driver-training/assessments`);
  await expect(page.getByRole("heading", { name: "Driver Performance Assessment" })).toBeVisible();
  await expect(page.getByText(/E2E Driver/)).toBeVisible();
});

test("mobile authenticated pages do not introduce horizontal document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  for (const pathname of ["/", "/inspections", "/driver-training", "/driver-training/assessments"]) {
    await page.goto(`${baseURL}${pathname}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
