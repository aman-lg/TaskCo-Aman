import { describe, it, expect } from "vitest";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations/projects";

describe("createProjectSchema", () => {
  it("accepts a minimal valid payload (title only)", () => {
    const result = createProjectSchema.safeParse({ title: "My Project" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urgency).toBe("medium");
      expect(result.data.status).toBe("active");
    }
  });

  it("accepts a full valid payload", () => {
    const result = createProjectSchema.safeParse({
      title: "Q3 Launch",
      description: "All Q3 deliverables",
      start_date: "2024-07-01",
      end_date: "2024-09-30",
      deadline: "2024-09-30T23:59:59+05:30",
      urgency: "high",
      status: "active",
      color: "#19183B",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = createProjectSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/required/i);
  });

  it("rejects a title exceeding 100 characters", () => {
    const result = createProjectSchema.safeParse({ title: "a".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/100/);
  });

  it("rejects a description exceeding 500 characters", () => {
    const result = createProjectSchema.safeParse({
      title: "Test",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/500/);
  });

  it("rejects an invalid urgency value", () => {
    const result = createProjectSchema.safeParse({ title: "Test", urgency: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = createProjectSchema.safeParse({ title: "Test", status: "paused" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid color format", () => {
    const result = createProjectSchema.safeParse({ title: "Test", color: "navy" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/hex/i);
  });

  it("accepts all valid urgency values", () => {
    for (const urgency of ["low", "medium", "high", "urgent"] as const) {
      const result = createProjectSchema.safeParse({ title: "Test", urgency });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid status values", () => {
    for (const status of ["active", "on_hold", "completed", "archived"] as const) {
      const result = createProjectSchema.safeParse({ title: "Test", status });
      expect(result.success).toBe(true);
    }
  });

  it("accepts null for nullable date fields", () => {
    const result = createProjectSchema.safeParse({
      title: "Test",
      start_date: null,
      end_date: null,
      deadline: null,
      color: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date string for start_date", () => {
    const result = createProjectSchema.safeParse({ title: "Test", start_date: "31-12-2024" });
    expect(result.success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a single field update", () => {
    const result = updateProjectSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("completed");
  });

  it("still validates field values when present", () => {
    const result = updateProjectSchema.safeParse({ urgency: "critical" });
    expect(result.success).toBe(false);
  });

  it("rejects title that exceeds max length", () => {
    const result = updateProjectSchema.safeParse({ title: "a".repeat(101) });
    expect(result.success).toBe(false);
  });
});
