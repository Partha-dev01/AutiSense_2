import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3003",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        bypassCSP: true,
        launchOptions: {
          args: ["--disable-web-security"],
        },
      },
    },
  ],
  webServer: {
    command: "npx next start -p 3003",
    port: 3003,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
