import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Tests run inside an isolated miniflare instance using the cloudflareTest
// plugin. Tests `import { env } from "cloudflare:test"` and hit real
// D1 / KV / R2 in the same shape as production — no mocking required.
//
// API changed in @cloudflare/vitest-pool-workers 0.16 (vitest 4 migration):
// - Old: `defineWorkersConfig({ test: { poolOptions: { workers: {...} } } })`
// - New: `defineConfig({ plugins: [cloudflareTest({...})] })`

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc", environment: "preview" },
      miniflare: {
        compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
      },
    }),
  ],
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Playwright specs live under tests/e2e and are run by `npm run test:e2e`.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
