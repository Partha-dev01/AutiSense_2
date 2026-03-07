import { test, expect } from "@playwright/test";

const BASE = "https://main.d2n7pu2vtgi8yc.amplifyapp.com";

test.use({
  storageState: "tests/auth-state.json",
  viewport: { width: 375, height: 812 },
});

test("Feed page - anonymous toggle visible", async ({ page }) => {
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/auth-feed-mobile.png", fullPage: true });
  // Click "New Post" button if visible
  const newPostBtn = page.locator("text=New Post");
  if (await newPostBtn.isVisible()) {
    await newPostBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/auth-feed-compose-mobile.png", fullPage: true });
  }
});

test("Chat page - input bar no overflow", async ({ page }) => {
  await page.goto(`${BASE}/kid-dashboard/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  await page.screenshot({ path: "test-results/auth-chat-mobile.png", fullPage: true });
});

test("Speech practice - stage labels", async ({ page }) => {
  await page.goto(`${BASE}/kid-dashboard/speech`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/auth-speech-mobile.png", fullPage: true });
});

test("Progress page - ThemeToggle, data display", async ({ page }) => {
  await page.goto(`${BASE}/kid-dashboard/progress`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/auth-progress-mobile.png", fullPage: true });
});

test("Kid dashboard - home page", async ({ page }) => {
  await page.goto(`${BASE}/kid-dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/auth-dashboard-mobile.png", fullPage: true });
});

test("Landing page - signed in nav (UserMenu + ThemeToggle)", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/auth-landing-mobile.png", fullPage: true });
});
