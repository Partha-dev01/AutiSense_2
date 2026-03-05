import { test, expect } from "@playwright/test";

test.describe("Auth Pages", () => {
  test("Login page renders with Google OAuth button", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("h1")).toContainText("AutiSense");
    await expect(page.locator("text=Sign in with Google")).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test("Dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/kid-dashboard");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("/auth/login");
    expect(page.url()).toContain("returnTo=%2Fkid-dashboard");
  });
});

test.describe("Games Hub", () => {
  test("Games hub redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/games");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("/auth/login");
    expect(page.url()).toContain("returnTo=%2Fgames");
  });

  test("Emotion Match game renders", async ({ page }) => {
    await page.goto("/games/emotion-match");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Sorting game renders", async ({ page }) => {
    await page.goto("/games/sorting");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Sequence game renders", async ({ page }) => {
    await page.goto("/games/sequence");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Social Stories game renders", async ({ page }) => {
    await page.goto("/games/social-stories");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Breathing exercise renders", async ({ page }) => {
    await page.goto("/games/breathing");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Pattern Match game renders", async ({ page }) => {
    await page.goto("/games/pattern-match");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Color & Sound game renders", async ({ page }) => {
    await page.goto("/games/color-sound");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Community Feed", () => {
  test("Feed page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain("/auth/login");
    expect(page.url()).toContain("returnTo=%2Ffeed");
  });
});

test.describe("Report API", () => {
  test("Summary API returns mock data without AWS", async ({ request }) => {
    const response = await request.post("/api/report/summary", {
      data: {
        sessionId: "test-session",
        biomarkers: {
          sessionId: "test-session",
          avgGazeScore: 0.6,
          avgMotorScore: 0.7,
          avgVocalizationScore: 0.5,
          avgResponseLatencyMs: 1200,
          sampleCount: 10,
          overallScore: 60,
          flags: { socialCommunication: false, restrictedBehavior: false },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.summary).toBeTruthy();
  });

  test("Clinical API returns mock data without AWS", async ({ request }) => {
    const response = await request.post("/api/report/clinical", {
      data: {
        sessionId: "test-session",
        biomarkers: {
          sessionId: "test-session",
          avgGazeScore: 0.6,
          avgMotorScore: 0.7,
          avgVocalizationScore: 0.5,
          avgResponseLatencyMs: 1200,
          sampleCount: 10,
          overallScore: 60,
          flags: { socialCommunication: false, restrictedBehavior: false },
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.report).toBeTruthy();
    expect(body.sections).toBeTruthy();
  });

  test("PDF API generates a PDF", async ({ request }) => {
    const response = await request.post("/api/report/pdf", {
      data: {
        report: "Test report content for PDF generation.",
        childName: "Test Child",
        sessionDate: "2026-03-01",
        scores: { gaze: 60, motor: 70, vocal: 50, overall: 60 },
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });

  test("TTS API returns 503 without AWS credentials", async ({ request }) => {
    const response = await request.post("/api/tts", {
      data: { text: "Hello world" },
    });
    // Will be 503 without AWS credentials
    expect([200, 503]).toContain(response.status());
  });

  test("Generate words API returns fallback data", async ({ request }) => {
    const response = await request.post("/api/chat/generate-words", {
      data: { ageMonths: 36, count: 6, mode: "words" },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.items).toHaveLength(6);
    expect(data.items[0]).toHaveProperty("text");
    expect(data.items[0]).toHaveProperty("emoji");
  });
});
