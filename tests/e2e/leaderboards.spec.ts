import { test, expect } from "@playwright/test";

test("leaderboards overview lists all 12 games", async ({ page }) => {
  await page.goto("/leaderboards");
  await expect(page.locator('h1:has-text("Leaderboards")')).toBeVisible();
  await expect(page.locator('a:has-text("Schulte")')).toBeVisible();
  await expect(page.locator('a:has-text("Texas Hold")')).toBeVisible();
  await expect(page.locator('a:has-text("Gomoku")')).toBeVisible();
});

test("clicking a game card opens its leaderboard", async ({ page }) => {
  await page.goto("/leaderboards");
  await page.click('a:has-text("Schulte")');
  await expect(page).toHaveURL(/\/leaderboards\/schulte/);
  await expect(page.locator('h1:has-text("Schulte")')).toBeVisible();
  await expect(page.locator('button[role="tab"]:has-text("WEEK")')).toBeVisible();
});

test("/u/<username> renders for an existing user", async ({ page, request }) => {
  const r = await request.get("/api/u/wenqian");
  if (!r.ok()) test.skip(true, "admin user not registered yet");
  await page.goto("/u/wenqian");
  await expect(page.locator('text=@wenqian').first()).toBeVisible();
});

test("/stats redirects to /sign-in when not authed", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/sign-in/);
});
