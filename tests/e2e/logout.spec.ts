/**
 * E2E tests — Logout flow
 *
 * Tests the full sign-out cycle: authenticated session → click Sign out →
 * redirected to /login → protected routes inaccessible.
 *
 * Tests that don't require real credentials (API-level) run unconditionally.
 * Tests that require a browser session are guarded by TEST_USER_EMAIL /
 * TEST_USER_PASSWORD env vars and skipped in CI unless those are set.
 *
 * Set these in a .env.test.local file (never committed):
 *   TEST_USER_EMAIL=you@company.com
 *   TEST_USER_PASSWORD=YourPassword1
 */

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function signInAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[id="email"]',    email);
  await page.fill('input[id="password"]', password);
  await page.click('button[type="submit"]');
  // Wait until we leave the login page
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

async function clickSignOut(page: Page) {
  // Open profile dropdown
  await page.getByRole("button", { name: /profile menu/i }).click();
  // Click Sign out item
  await page.getByRole("menuitem", { name: /sign out/i }).click();
}

// ── API-level tests (no credentials required) ────────────────────────────────

test.describe("POST /api/auth/logout — API contract", () => {
  test("returns 200 with success:true when called without a session (idempotent)", async ({ request }) => {
    const res = await request.post("/api/auth/logout");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  test("returns 405 for GET requests", async ({ request }) => {
    const res = await request.get("/api/auth/logout");
    expect(res.status()).toBe(405);
  });

  test("returns 405 for PUT requests", async ({ request }) => {
    const res = await request.put("/api/auth/logout");
    expect(res.status()).toBe(405);
  });

  test("response does not contain session or token data", async ({ request }) => {
    const res  = await request.post("/api/auth/logout");
    const text = await res.text();
    expect(text).not.toMatch(/token/i);
    expect(text).not.toMatch(/session/i);
  });
});

// ── Full browser flow (requires TEST_USER credentials) ───────────────────────

test.describe("Sign-out user flow", () => {
  test.beforeEach(({ page }) => {
    const email    = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) test.skip();
    void page; // suppress unused-param warning
  });

  test("clicking Sign out redirects to /login", async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    await signInAs(page, email, password);
    await clickSignOut(page);

    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("/dashboard is inaccessible after sign-out (redirects to /login)", async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    await signInAs(page, email, password);
    await clickSignOut(page);
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    // Attempt to navigate back to a protected page
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Sign out button shows loading state while request is in flight", async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    await signInAs(page, email, password);

    // Open profile dropdown
    await page.getByRole("button", { name: /profile menu/i }).click();

    // Click and immediately check for loading text (before redirect)
    const signOutItem = page.getByRole("menuitem", { name: /sign out/i });
    await signOutItem.click();

    // Either the button shows "Signing out…" or we've already been redirected
    const url = page.url();
    if (!url.includes("/login")) {
      await expect(page.getByText(/signing out/i)).toBeVisible({ timeout: 2_000 });
    }

    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("authenticated user info is not visible on /login after sign-out", async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    await signInAs(page, email, password);
    await clickSignOut(page);
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    // The topbar (which shows the user's avatar/name) should not be present
    await expect(page.getByRole("button", { name: /profile menu/i })).not.toBeVisible();
  });

  test("signing in again after sign-out works correctly", async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    await signInAs(page, email, password);
    await clickSignOut(page);
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    // Sign back in
    await signInAs(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
