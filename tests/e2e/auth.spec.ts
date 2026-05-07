import { test, expect } from "@playwright/test";

// Unique-per-run user identity so tests don't collide on repeat runs.
const SUFFIX = `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 4)}`;
const username = `e2e${SUFFIX}`.slice(0, 20);
const email = `e2e+${SUFFIX}@example.test`;
const password = "TestPass1234";

test.describe("auth flow", () => {
  test("home unauthed shows SIGN IN button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a:has-text("SIGN IN")')).toBeVisible();
  });

  test("sign-in page renders the full card", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();
    await expect(page.locator('input[type="text"][autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("SIGN IN")')).toBeVisible();
    await expect(page.locator('a:has-text("Forgot password?")')).toBeVisible();
    await expect(page.locator('a:has-text("Create account")')).toBeVisible();
  });

  test("sign-up renders the full form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator('h1:has-text("Create account")')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("SIGN UP")')).toBeVisible();
  });

  test("sign-up + verify-email + profile happy path", async ({ page, request }) => {
    // 1. Open sign-up, fill form
    await page.goto("/sign-up");
    await page.fill('input[name="username"]', username);
    await page.fill('input[type="text"][maxlength="64"]', `E2E ${SUFFIX}`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]:has-text("SIGN UP")');

    // 2. Lands on /verify-email "Check your inbox" splash
    await expect(page).toHaveURL(/\/verify-email/);
    await expect(page.locator('h1:has-text("Check your email")')).toBeVisible();

    // (We can't click the email link in an automated test without integrating
    // an email-receiving service. Instead, smoke-test that sign-in still
    // accepts the just-registered account — the requireVerifiedSession gate
    // applies only to write endpoints; sign-in itself is allowed.)

    // 3. Sign in via the just-registered identity
    await page.goto("/sign-in");
    await page.fill('input[autocomplete="username"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]:has-text("SIGN IN")');

    // Expectation: redirect to /profile (the default ?next).
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator(`text=@${username}`).first()).toBeVisible();
  });

  test("(auth) layout redirects authed user to /profile", async ({ page, context }) => {
    // Use the same browser context (which has the cookies from the previous
    // test). Navigating to /sign-in should redirect to /profile.
    if (context.pages().length === 0) test.skip();
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/profile/);
  });

  test("UserWidget shows authed dropdown items", async ({ page }) => {
    await page.goto("/");
    // Click the avatar button (top-right, role=button with avatar/initials inside).
    const avatarBtn = page.locator('button[aria-haspopup="menu"]');
    await expect(avatarBtn).toBeVisible();
    await avatarBtn.click();
    await expect(page.locator('a:has-text("Profile")')).toBeVisible();
    await expect(page.locator('a:has-text("Settings")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign out")')).toBeVisible();
  });
});
