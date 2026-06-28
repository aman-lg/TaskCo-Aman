import { describe, it, expect } from "vitest";
import {
  createTaskSchema,
  updateTaskSchema,
  assignTaskSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} from "@/lib/validations/tasks";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_DATETIME = "2024-12-31T23:59:59+05:30";

describe("createTaskSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "Fix login bug" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urgency).toBe("medium");
      expect(result.data.status).toBe("todo");
    }
  });

  it("accepts a full valid payload", () => {
    const result = createTaskSchema.safeParse({
      project_id: VALID_UUID,
      name: "Design the onboarding flow",
      description: "Cover all edge cases",
      urgency: "high",
      status: "in_progress",
      deadline: VALID_DATETIME,
      color: "#A1C2BD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing project_id", () => {
    const result = createTaskSchema.safeParse({ name: "Task" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID project_id", () => {
    const result = createTaskSchema.safeParse({ project_id: "not-a-uuid", name: "Task" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/valid project ID/i);
  });

  it("rejects an empty name", () => {
    const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/required/i);
  });

  it("rejects a name exceeding 200 characters", () => {
    const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "a".repeat(201) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/200/);
  });

  it("rejects a description exceeding 2000 characters", () => {
    const result = createTaskSchema.safeParse({
      project_id: VALID_UUID,
      name: "Task",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/2000/);
  });

  it("rejects an invalid urgency value", () => {
    const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "Task", urgency: "critical" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "Task", status: "blocked" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid status values", () => {
    for (const status of ["todo", "in_progress", "done"] as const) {
      const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "Task", status });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid urgency values", () => {
    for (const urgency of ["low", "medium", "high", "urgent"] as const) {
      const result = createTaskSchema.safeParse({ project_id: VALID_UUID, name: "Task", urgency });
      expect(result.success).toBe(true);
    }
  });

  it("accepts null for nullable fields", () => {
    const result = createTaskSchema.safeParse({
      project_id: VALID_UUID,
      name: "Task",
      description: null,
      deadline: null,
      color: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateTaskSchema", () => {
  it("accepts an empty object", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("does NOT accept project_id (field is stripped)", () => {
    const result = updateTaskSchema.safeParse({ project_id: VALID_UUID, name: "x" });
    expect(result.success).toBe(true);
    // project_id should be absent from parsed output
    if (result.success) {
      expect("project_id" in result.data).toBe(false);
    }
  });

  it("accepts a single valid field update", () => {
    const result = updateTaskSchema.safeParse({ status: "done" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("done");
  });

  it("still validates field values when present", () => {
    const result = updateTaskSchema.safeParse({ urgency: "very-high" });
    expect(result.success).toBe(false);
  });
});

describe("assignTaskSchema", () => {
  it("accepts a valid user UUID", () => {
    const result = assignTaskSchema.safeParse({ user_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID user_id", () => {
    const result = assignTaskSchema.safeParse({ user_id: "not-uuid" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/valid user ID/i);
  });

  it("rejects missing user_id", () => {
    const result = assignTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createChecklistItemSchema", () => {
  it("accepts valid content", () => {
    const result = createChecklistItemSchema.safeParse({ content: "Write unit tests" });
    expect(result.success).toBe(true);
  });

  it("accepts content with position", () => {
    const result = createChecklistItemSchema.safeParse({ content: "First step", position: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.position).toBe(0);
  });

  it("rejects empty content", () => {
    const result = createChecklistItemSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/required/i);
  });

  it("rejects content exceeding 500 characters", () => {
    const result = createChecklistItemSchema.safeParse({ content: "a".repeat(501) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/500/);
  });

  it("rejects a negative position", () => {
    const result = createChecklistItemSchema.safeParse({ content: "Step", position: -1 });
    expect(result.success).toBe(false);
  });
});

describe("updateChecklistItemSchema", () => {
  it("accepts an empty object (all optional)", () => {
    const result = updateChecklistItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts toggling is_done to true", () => {
    const result = updateChecklistItemSchema.safeParse({ is_done: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_done).toBe(true);
  });

  it("accepts updating content", () => {
    const result = updateChecklistItemSchema.safeParse({ content: "Updated step" });
    expect(result.success).toBe(true);
  });

  it("accepts updating position", () => {
    const result = updateChecklistItemSchema.safeParse({ position: 5 });
    expect(result.success).toBe(true);
  });
});
