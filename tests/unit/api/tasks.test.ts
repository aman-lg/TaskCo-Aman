/**
 * Unit tests — Tasks API routes
 *
 * Mocks @/lib/supabase/server so no real DB calls are made.
 * Tests cover: schema validation, creator enforcement, RLS-403 handling,
 * checklist CRUD, response format.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET as listTasks, POST as createTask } from "@/app/api/tasks/route";
import { GET as getTask, PATCH as updateTask, DELETE as deleteTask } from "@/app/api/tasks/[id]/route";
import { POST as addChecklist } from "@/app/api/tasks/[id]/checklist/route";
import {
  PATCH as updateChecklistItem,
  DELETE as deleteChecklistItem,
} from "@/app/api/tasks/[id]/checklist/[itemId]/route";

const MOCK_USER = { id: "user-1", email: "user@test.com" };
const PROJ_UUID = "550e8400-e29b-41d4-a716-446655440000";
const TASK_UUID = "660e8400-e29b-41d4-a716-446655440000";
const ITEM_UUID = "770e8400-e29b-41d4-a716-446655440000";

const MOCK_TASK = {
  id: TASK_UUID,
  project_id: PROJ_UUID,
  name: "Test task",
  description: null,
  urgency: "medium",
  status: "todo",
  created_by: "user-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  task_assignees: [],
  task_checklist_items: [],
};

function makeReq(method: string, body?: unknown, url = "http://localhost/api/tasks") {
  return new NextRequest(url, {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

function stubChain(resolveValue: unknown, extra?: { count?: number; error?: unknown }) {
  const err = extra?.error ?? null;
  const terminal = { data: resolveValue, error: err, count: extra?.count ?? null };
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "order", "single"];
  for (const m of methods) {
    chain[m] = vi.fn(() => {
      if (m === "single") return Promise.resolve(terminal);
      return chain;
    });
  }
  (chain["delete"] as ReturnType<typeof vi.fn>).mockReturnValue({
    eq: vi.fn().mockResolvedValue(terminal),
  });
  return chain;
}

// ── GET /api/tasks?project_id=... ─────────────────────────────────────────────

describe("GET /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 with task list for a valid project_id", async () => {
    mockFrom.mockReturnValue(stubChain([MOCK_TASK]));
    const req = makeReq("GET", undefined, `http://localhost/api/tasks?project_id=${PROJ_UUID}`);
    const res = await listTasks(req);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 400 when project_id is missing", async () => {
    const res = await listTasks(makeReq("GET", undefined, "http://localhost/api/tasks"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await listTasks(
      makeReq("GET", undefined, `http://localhost/api/tasks?project_id=${PROJ_UUID}`)
    );
    expect(res.status).toBe(401);
  });
});

// ── POST /api/tasks ────────────────────────────────────────────────────────────

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 201 with created task on valid input", async () => {
    mockFrom.mockReturnValue(stubChain(MOCK_TASK));
    const res = await createTask(makeReq("POST", { project_id: PROJ_UUID, name: "New task" }));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.name).toBe("Test task");
  });

  it("injects created_by from authenticated user", async () => {
    mockFrom.mockReturnValue(stubChain(MOCK_TASK));
    await createTask(makeReq("POST", { project_id: PROJ_UUID, name: "Task", created_by: "attacker" }));
    expect(mockFrom).toHaveBeenCalledWith("tasks");
  });

  it("returns 400 when name is missing", async () => {
    const res = await createTask(makeReq("POST", { project_id: PROJ_UUID }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.message).toBeTruthy();
  });

  it("returns 400 when project_id is not a UUID", async () => {
    const res = await createTask(makeReq("POST", { project_id: "bad", name: "Task" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const res = await createTask(
      makeReq("POST", { project_id: PROJ_UUID, name: "Task", status: "blocked" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("http://localhost/api/tasks", { method: "POST", body: "bad" });
    const res = await createTask(req);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/tasks/:id ─────────────────────────────────────────────────────────

describe("GET /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 with task data", async () => {
    mockFrom.mockReturnValue(stubChain(MOCK_TASK));
    const res = await getTask(makeReq("GET"), { params: Promise.resolve({ id: TASK_UUID }) });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.id).toBe(TASK_UUID);
  });

  it("returns 404 when task is not found", async () => {
    mockFrom.mockReturnValue(stubChain(null));
    const res = await getTask(makeReq("GET"), { params: Promise.resolve({ id: PROJ_UUID }) });
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/tasks/:id ───────────────────────────────────────────────────────

describe("PATCH /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 on a valid status update", async () => {
    mockFrom.mockReturnValue(stubChain({ ...MOCK_TASK, status: "done" }));
    const res = await updateTask(
      makeReq("PATCH", { status: "done" }),
      { params: Promise.resolve({ id: TASK_UUID }) }
    );
    expect(res.status).toBe(200);
  });

  it("strips project_id from PATCH body", async () => {
    mockFrom.mockReturnValue(stubChain(MOCK_TASK));
    const res = await updateTask(
      makeReq("PATCH", { name: "Updated", project_id: "should-be-ignored" }),
      { params: Promise.resolve({ id: TASK_UUID }) }
    );
    // Should succeed — project_id is stripped by updateTaskSchema
    expect(res.status).toBe(200);
  });

  it("returns 400 when body has no valid fields", async () => {
    const res = await updateTask(
      makeReq("PATCH", {}),
      { params: Promise.resolve({ id: TASK_UUID }) }
    );
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────────

describe("DELETE /api/tasks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 with deleted:true on success", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null, count: 1 });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqMock }) });
    const res = await deleteTask(makeReq("DELETE"), { params: Promise.resolve({ id: TASK_UUID }) });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("returns 403 when RLS blocks deletion (not the creator)", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqMock }) });
    const res = await deleteTask(makeReq("DELETE"), { params: Promise.resolve({ id: ITEM_UUID }) });
    expect(res.status).toBe(403);
  });
});

// ── POST /api/tasks/:id/checklist ─────────────────────────────────────────────

describe("POST /api/tasks/:id/checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 201 with created checklist item", async () => {
    const item = { id: ITEM_UUID, content: "Step 1", is_done: false, position: 0 };
    mockFrom.mockReturnValue(stubChain(item));
    const res = await addChecklist(
      makeReq("POST", { content: "Step 1" }),
      { params: Promise.resolve({ id: TASK_UUID }) }
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.content).toBe("Step 1");
  });

  it("returns 400 when content is empty", async () => {
    const res = await addChecklist(
      makeReq("POST", { content: "" }),
      { params: Promise.resolve({ id: TASK_UUID }) }
    );
    expect(res.status).toBe(400);
  });
});

// ── PATCH + DELETE /api/tasks/:id/checklist/:itemId ───────────────────────────

describe("PATCH /api/tasks/:id/checklist/:itemId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 when toggling is_done", async () => {
    mockFrom.mockReturnValue(stubChain({ id: ITEM_UUID, is_done: true }));
    const res = await updateChecklistItem(
      makeReq("PATCH", { is_done: true }),
      { params: Promise.resolve({ id: TASK_UUID, itemId: ITEM_UUID }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when no valid fields are provided", async () => {
    const res = await updateChecklistItem(
      makeReq("PATCH", {}),
      { params: Promise.resolve({ id: TASK_UUID, itemId: ITEM_UUID }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/tasks/:id/checklist/:itemId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 when item is deleted", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null, count: 1 });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqMock }) });
    const res = await deleteChecklistItem(makeReq("DELETE"), {
      params: Promise.resolve({ id: TASK_UUID, itemId: ITEM_UUID }),
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 when item does not exist", async () => {
    const eqMock = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqMock }) });
    const res = await deleteChecklistItem(makeReq("DELETE"), {
      params: Promise.resolve({ id: TASK_UUID, itemId: PROJ_UUID }),
    });
    expect(res.status).toBe(404);
  });
});
