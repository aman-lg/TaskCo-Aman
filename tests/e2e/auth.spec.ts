import { test, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function fillLogin(page: Page, email: string, password: string) {
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', password);
  await page.click('button[type="submit"]');
}

async function fillRegister(
  page: Page,
  opts: { fullName: string; email: string; password: string; confirmPassword: string }
) {
  await page.fill('input[id="fullName"]', opts.fullName);
  await page.fill('input[id="email"]', opts.email);
  await page.fill('input[id="password"]', opts.password);
  await page.fill('input[id="confirmPassword"]', opts.confirmPassword);
  await page.click('button[type="submit"]');
}

// ─────────────────────────────────────────────
// Login page — structure
// ─────────────────────────────────────────────
test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders heading, email, password fields and submit button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows link to register page", async ({ page }) => {
    await expect(page.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  test("shows link to forgot password", async ({ page }) => {
    await expect(page.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  test("password field is masked by default", async ({ page }) => {
    const input = page.locator('input[id="password"]');
    await expect(input).toHaveAttribute("type", "password");
  });

  test("toggle shows and hides password", async ({ page }) => {
    const input = page.locator('input[id="password"]');
    const toggle = page.getByRole("button", { name: /show password/i });
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(input).toHaveAttribute("type", "password");
  });

  // ── Client-side validation (no network) ──
  test("shows required errors when submitted empty", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("shows invalid email error for malformed email", async ({ page }) => {
    await page.fill('input[id="email"]', "not-an-email");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Invalid email address")).toBeVisible();
  });

  // ── Server error scenarios ──
  test("shows error toast for wrong credentials", async ({ page }) => {
    await fillLogin(page, "wrong@example.com", "WrongPass1");
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows unverified email message for unverified users", async ({ page }) => {
    // This test assumes a test account that exists but hasn't verified email.
    // Skip if no TEST_UNVERIFIED_EMAIL env var is set.
    const email = process.env.TEST_UNVERIFIED_EMAIL;
    if (!email) test.skip();
    await fillLogin(page, email!, "Test1234!");
    await expect(page.getByText(/verify your email/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Redirect behaviour ──
  test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated user visiting /login redirects to /dashboard", async ({ page }) => {
    // Only meaningful if TEST_USER credentials are set
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) test.skip();
    await fillLogin(page, email!, password!);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });
});

// ─────────────────────────────────────────────
// Register page — structure + validation
// ─────────────────────────────────────────────
test.describe("Register page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  test("renders all form fields", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.locator('input[id="fullName"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
  });

  test("shows all required errors when submitted empty", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.getByText(/full name must be at least/i)).toBeVisible();
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password must be at least/i)).toBeVisible();
  });

  test("shows password strength errors", async ({ page }) => {
    await page.fill('input[id="fullName"]', "Aman Kumar");
    await page.fill('input[id="email"]', "aman@test.com");
    await page.fill('input[id="password"]', "weak");
    await page.fill('input[id="confirmPassword"]', "weak");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/at least 8/i)).toBeVisible();
  });

  test("shows mismatch error when passwords differ", async ({ page }) => {
    await page.fill('input[id="fullName"]', "Aman Kumar");
    await page.fill('input[id="email"]', "aman@test.com");
    await page.fill('input[id="password"]', "Secure123");
    await page.fill('input[id="confirmPassword"]', "Different1");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("has link back to login", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  test("successful registration redirects to verify-email page", async ({ page }) => {
    const uniqueEmail = `test+${Date.now()}@taskco-test.example`;
    await fillRegister(page, {
      fullName: "Test User",
      email: uniqueEmail,
      password: "Secure123!",
      confirmPassword: "Secure123!",
    });
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 10000 });
    await expect(page.getByText(/verify your email/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// Forgot password page
// ─────────────────────────────────────────────
test.describe("Forgot password page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("renders heading and email field", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
  });

  test("shows error on empty submit", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test("shows error for invalid email", async ({ page }) => {
    await page.fill('input[id="email"]', "bad");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
  });

  test("shows success state after valid submission", async ({ page }) => {
    await page.fill('input[id="email"]', "someone@example.com");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("someone@example.com")).toBeVisible();
  });

  test("has back-to-login link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/login");
  });
});

// ─────────────────────────────────────────────
// Reset password page
// ─────────────────────────────────────────────
test.describe("Reset password page", () => {
  test.beforeEach(async ({ page }) => {
    // The reset password page requires an active session (from the OTP confirm flow).
    // In unit/integration tests this page is tested without a session to verify validation only.
    await page.goto("/reset-password");
  });

  test("renders password fields", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.getByText(/at least 8/i)).toBeVisible();
  });

  test("shows mismatch error", async ({ page }) => {
    await page.fill('input[id="password"]', "NewPass1");
    await page.fill('input[id="confirmPassword"]', "Different1");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// Verify email page
// ─────────────────────────────────────────────
test.describe("Verify email page", () => {
  test("renders instructions with email from query param", async ({ page }) => {
    await page.goto("/verify-email?email=aman%40company.com");
    await expect(page.getByText(/verify your email/i)).toBeVisible();
    await expect(page.getByText("aman@company.com")).toBeVisible();
  });

  test("renders without email param gracefully", async ({ page }) => {
    await page.goto("/verify-email");
    await expect(page.getByText(/verify your email/i)).toBeVisible();
    await expect(page.getByText(/your email address/i)).toBeVisible();
  });
});
