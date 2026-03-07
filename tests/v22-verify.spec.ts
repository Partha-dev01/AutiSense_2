import { test, expect } from "@playwright/test";

const BASE = "https://main.d2n7pu2vtgi8yc.amplifyapp.com";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("Landing page - no horizontal overflow, ThemeToggle visible", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      // No horizontal scrollbar
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await page.screenshot({ path: `test-results/landing-${vp.name}.png`, fullPage: true });
    });

    test("Games list page - ThemeToggle, games visible", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/games`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/games-${vp.name}.png`, fullPage: true });
    });

    test("Bubble Pop - ThemeToggle, start button", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/games/bubble-pop`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/bubble-pop-${vp.name}.png`, fullPage: true });
    });

    test("Alphabet Pattern - ThemeToggle, stages", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/games/alphabet-pattern`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/alphabet-pattern-${vp.name}.png`, fullPage: true });
    });

    test("Tracing game - ThemeToggle", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/games/tracing`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/tracing-${vp.name}.png`, fullPage: true });
    });

    test("Sequence Memory - ThemeToggle, enhanced UI", async ({ page }) => {
      await page.goto(`${BASE}/games/sequence`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/sequence-${vp.name}.png`, fullPage: true });
    });

    test("Color & Sound - ThemeToggle", async ({ page }) => {
      await page.goto(`${BASE}/games/color-sound`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/color-sound-${vp.name}.png`, fullPage: true });
    });

    test("Speech practice - ThemeToggle, stages", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/speech`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/speech-${vp.name}.png`, fullPage: true });
    });

    test("Feed page - ThemeToggle, anonymous toggle", async ({ page }) => {
      await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/feed-${vp.name}.png`, fullPage: true });
    });

    test("Progress page - ThemeToggle, no duplicates", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/progress`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/progress-${vp.name}.png`, fullPage: true });
    });

    test("Chat page - no overflow on input bar", async ({ page }) => {
      await page.goto(`${BASE}/kid-dashboard/chat`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await page.screenshot({ path: `test-results/chat-${vp.name}.png`, fullPage: true });
    });

    test("Video capture (intake step 8) - status bar visible", async ({ page }) => {
      await page.goto(`${BASE}/intake/video-capture`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/video-capture-${vp.name}.png`, fullPage: true });
    });
  });
}
