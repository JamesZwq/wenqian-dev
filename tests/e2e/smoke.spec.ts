import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Wenqian Zhang/);
});

test("health endpoint reports all bindings ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { ok: boolean; checks: Record<string, string> };
  expect(body.ok).toBe(true);
  expect(body.checks.db).toBe("ok");
  expect(body.checks.kv).toBe("ok");
  expect(body.checks.r2).toBe("ok");
});

test("static OG card is served", async ({ request }) => {
  const res = await request.get("/og/default.png");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("image/png");
});
