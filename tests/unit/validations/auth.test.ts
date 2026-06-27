import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

// ─────────────────────────────────────────────
// loginSchema
// ─────────────────────────────────────────────
describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret123" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("Email is required");
  });

  it("rejects malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("Invalid email address");
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password).toContain("Password is required");
  });

  it("rejects missing both fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
    const errs = result.error?.flatten().fieldErrors;
    expect(errs?.email).toBeDefined();
    expect(errs?.password).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────
describe("registerSchema", () => {
  const valid = {
    fullName: "Aman Kumar",
    email: "aman@company.com",
    password: "Secure123",
    confirmPassword: "Secure123",
  };

  it("accepts valid registration data", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects full name shorter than 2 chars", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.fullName?.[0]).toMatch(/at least 2/);
  });

  it("rejects full name over 100 chars", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "A".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.fullName?.[0]).toMatch(/under 100/);
  });

  it("rejects full name with invalid characters", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "Aman123!" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.fullName?.[0]).toMatch(/invalid characters/);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "bad-email" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("Invalid email address");
  });

  it("rejects password shorter than 8 chars", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Abc1", confirmPassword: "Abc1" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/at least 8/);
  });

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({ ...valid, password: "secure123", confirmPassword: "secure123" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/uppercase/);
  });

  it("rejects password without number", () => {
    const result = registerSchema.safeParse({ ...valid, password: "SecurePass", confirmPassword: "SecurePass" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/number/);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "Different1" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match");
  });

  it("accepts hyphens and apostrophes in names", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "Mary-Jane O'Brien" });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────
// forgotPasswordSchema
// ─────────────────────────────────────────────
describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("Email is required");
  });

  it("rejects malformed email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "notanemail" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toContain("Invalid email address");
  });
});

// ─────────────────────────────────────────────
// resetPasswordSchema
// ─────────────────────────────────────────────
describe("resetPasswordSchema", () => {
  const valid = { password: "NewPass1", confirmPassword: "NewPass1" };

  it("accepts valid matching passwords", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = resetPasswordSchema.safeParse({ password: "Ab1", confirmPassword: "Ab1" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/at least 8/);
  });

  it("rejects password without uppercase", () => {
    const result = resetPasswordSchema.safeParse({ password: "newpass1", confirmPassword: "newpass1" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/uppercase/);
  });

  it("rejects password without number", () => {
    const result = resetPasswordSchema.safeParse({ password: "NewPassword", confirmPassword: "NewPassword" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password?.[0]).toMatch(/number/);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "NewPass1", confirmPassword: "Different1" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match");
  });

  it("rejects empty confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({ password: "NewPass1", confirmPassword: "" });
    expect(result.success).toBe(false);
  });
});
