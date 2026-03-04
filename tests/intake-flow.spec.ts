import { test, expect } from "@playwright/test";

test.describe("Intake Flow — Full 10-Step Progression", () => {
  test("Landing page → Profile (consent)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Computer-assisted autism screening");
    await page.click("text=Begin Free Autism Screening →");
    await expect(page).toHaveURL("/intake/profile");
  });

  test("Step 1 Consent → Step 2 Child Profile", async ({ page }) => {
    await page.goto("/intake/profile");
    await expect(page.locator(".chip")).toContainText("Step 1");
    const btn = page.locator("button", { hasText: "Continue →" });
    await expect(btn).toBeDisabled();
    await page.click("label[for='consent']");
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(page).toHaveURL("/intake/child-profile");
  });

  test("Step 2 Profile Form → Step 3 Device Check", async ({ page }) => {
    await page.goto("/intake/child-profile");
    await expect(page.locator(".chip")).toContainText("Step 2");
    await page.fill("#childName", "Test");
    await page.fill("#dob", "2022-06-15");
    await page.selectOption("#language", "English");
    await page.fill("#parentName", "Parent");
    await page.click("button:has-text('Continue →')");
    await expect(page).toHaveURL("/intake/device-check");
  });

  test("Step 3 Device Check renders", async ({ page }) => {
    await page.goto("/intake/device-check");
    await expect(page.locator(".chip")).toContainText("Step 3");
    await expect(page.locator("button:has-text('Check My Device')")).toBeVisible();
  });

  test("Step 4 Communication renders", async ({ page }) => {
    await page.goto("/intake/communication");
    await expect(page.locator(".chip")).toContainText("Step 4");
    await expect(page.locator("h1")).toContainText("echo");
    await expect(page.locator("text=Generating").or(page.locator("button:has-text('Start Word Echo')"))).toBeVisible();
  });

  test("Step 5 Behavioral Observation renders", async ({ page }) => {
    await page.goto("/intake/behavioral-observation");
    await expect(page.locator(".chip")).toContainText("Step 5");
    await expect(page.locator("h1")).toContainText("bubbles");
    await expect(page.locator("button:has-text('Start Bubble Pop')")).toBeVisible();
  });

  test("Step 6 Preparation renders", async ({ page }) => {
    await page.goto("/intake/preparation");
    await expect(page.locator(".chip")).toContainText("Step 6");
    await expect(page.locator("h1")).toContainText("moves");
    await expect(page.locator("button:has-text('Start Action Challenge')")).toBeVisible();
  });

  test("Step 7 Motor Assessment renders", async ({ page }) => {
    await page.goto("/intake/motor");
    await expect(page.locator(".chip")).toContainText("Step 7");
    await expect(page.locator("h1")).toContainText("targets");
    await expect(page.locator("button:has-text('Start Motor Test')")).toBeVisible();
  });

  test("Step 8 Video Capture renders", async ({ page }) => {
    await page.goto("/intake/video-capture");
    await expect(page.locator(".chip")).toContainText("Step 8");
    await expect(page.locator("h1")).toContainText("screening");
    await expect(page.locator("button:has-text('Start Video Analysis')")).toBeVisible();
  });

  test("Step 9 Summary renders", async ({ page }) => {
    await page.goto("/intake/summary");
    await expect(page).toHaveURL("/intake/summary");
  });

  test("Step 10 Report renders", async ({ page }) => {
    await page.goto("/intake/report");
    await expect(page.locator(".chip")).toContainText("Step 10");
    await expect(page.locator("h1")).toContainText("clinical report");
    await expect(page.locator("text=Quick Summary").first()).toBeVisible();
  });

  test("Back buttons navigate correctly", async ({ page }) => {
    await page.goto("/intake/child-profile");
    await page.click("a:has-text('← Back')");
    await expect(page).toHaveURL("/intake/profile");

    await page.goto("/intake/device-check");
    await page.click("a:has-text('← Back')");
    await expect(page).toHaveURL("/intake/child-profile");

    await page.goto("/intake/communication");
    await page.click("a:has-text('← Back')");
    await expect(page).toHaveURL("/intake/device-check");
  });

  test("Skip Stage button visible on assessment pages", async ({ page }) => {
    // Skip button should appear on all 5 assessment stages
    for (const route of [
      "/intake/communication",
      "/intake/behavioral-observation",
      "/intake/preparation",
      "/intake/motor",
      "/intake/video-capture",
    ]) {
      await page.goto(route);
      await expect(page.locator("button:has-text('Skip Stage')")).toBeVisible();
    }
  });

  test("Skip Stage dialog opens and can be cancelled", async ({ page }) => {
    await page.goto("/intake/communication");
    await page.click("button:has-text('Skip Stage')");
    await expect(page.locator("text=Skip this stage?")).toBeVisible();
    await page.click("button:has-text('Cancel')");
    await expect(page.locator("text=Skip this stage?")).not.toBeVisible();
  });

  test("Full flow: Landing → Consent → Profile → Device Check", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Begin Free Autism Screening →");
    await expect(page).toHaveURL("/intake/profile");

    await page.click("label[for='consent']");
    await page.click("button:has-text('Continue →')");
    await expect(page).toHaveURL("/intake/child-profile");

    await page.fill("#childName", "Arjun");
    await page.fill("#dob", "2023-01-10");
    await page.selectOption("#language", "Hindi");
    await page.fill("#parentName", "Priya");
    await page.click("button:has-text('Continue →')");
    await expect(page).toHaveURL("/intake/device-check");

    await expect(page.locator(".step-dot")).toHaveCount(10);
  });
});
