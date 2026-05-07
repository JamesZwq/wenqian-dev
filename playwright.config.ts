import { defineConfig } from "@playwright/test";

// E2E tests run against a Worker dev server (`npm run dev:worker`). In CI you
// can override the target with PLAYWRIGHT_BASE_URL — useful for hitting a
// preview deployment URL instead of spinning up a fresh dev server.

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev:worker",
        url: "http://localhost:8787",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
