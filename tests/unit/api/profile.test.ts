/**
 * Unit tests — GET + PATCH /api/profile
 *
 * Mocks @/lib/supabase/server — no real DB calls.
 * Coverage:
 *  GET
 *   - 200 with profile data including phone
 *   - 401 when not authenticated
 *   - 404 when profile row missing
 *  PATCH
 *   - 200 on valid full_name update
 *   - 200 on valid phone update (E.164 format)
 *   - 200 on phone set to null (clearing)
 *   - 200 on valid avatar_url update
 *   - 400 on invalid JSON body
 *   - 400 on empty full_name
 *   - 400 on full_name > 100 chars
 *   - 400 on invalid phone format (no + prefix)
 *   - 400 on invalid phone format (too short)
 *   - 400 on non-HTTPS avatar URL
 *   - 400 on avatar URL not on supabase.co
 *   - 500 on Supabase DB error (no message leak)
 *   - 401 when not authenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

import { GET, PATCH } from "@/app/api/profile/route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: "11111111-1111-1111-1111-111111111111", email: "user@test.com" };

const MOCK_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: "Test User",
  avatar_url: null,
  phone: "+911234567890",
  created_at: "2025-01-01T00:00:00Z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/profile", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

/** Chain builder for .from().select().eq().single() */
function fromChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn().mockReturnThis(),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

/** Chain builder for .from().update().eq() */
function updateChain(result: { error: unknown }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("returns 200 with profile data", async () => {
    fromChain({ data: MOCK_PROFILE, error: null });
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toMatchObject({ id: MOCK_USER.id, email: MOCK_USER.email });
  });

  it("includes phone in the response", async () => {
    fromChain({ data: MOCK_PROFILE, error: null });
    const res = await GET(makeReq("GET"));
    const body = await res.json();
    expect(body.data.phone).toBe("+911234567890");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Not authenticated" } });
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when profile row is missing", async () => {
    fromChain({ data: null, error: { code: "PGRST116", message: "No rows returned" } });
    const res = await GET(makeReq("GET"));
    expect(res.status).toBe(404);
  });

  it("response is JSON with correct content-type", async () => {
    fromChain({ data: MOCK_PROFILE, error: null });
    const res = await GET(makeReq("GET"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

// ── PATCH tests ───────────────────────────────────────────────────────────────

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  // ── Happy paths ────────────────────────────────────────────────────────────

  it("returns 200 on valid full_name update", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", { full_name: "New Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("returns 200 on valid E.164 phone update", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", { phone: "+14155552671" }));
    expect(res.status).toBe(200);
  });

  it("accepts Indian mobile format +911234567890", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", { phone: "+911234567890" }));
    expect(res.status).toBe(200);
  });

  it("returns 200 when phone is null (clearing phone)", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", { phone: null }));
    expect(res.status).toBe(200);
  });

  it("returns 200 on valid Supabase avatar_url", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", {
      avatar_url: "https://abcdefgh.supabase.co/storage/v1/object/public/avatars/pic.png",
    }));
    expect(res.status).toBe(200);
  });

  it("returns 200 when body has no fields (no-op update)", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", {}));
    expect(res.status).toBe(200);
  });

  // ── Validation errors ──────────────────────────────────────────────────────

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/profile", {
      method: "PATCH",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when full_name is empty string", async () => {
    const res = await PATCH(makeReq("PATCH", { full_name: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/name is required/i);
  });

  it("returns 400 when full_name exceeds 100 chars", async () => {
    const res = await PATCH(makeReq("PATCH", { full_name: "a".repeat(101) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/max 100/i);
  });

  it("returns 400 when phone lacks + prefix", async () => {
    const res = await PATCH(makeReq("PATCH", { phone: "911234567890" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/phone/i);
  });

  it("returns 400 when phone is too short (just country code, no subscriber number)", async () => {
    // "+1" has only one digit after +; regex requires [1-9]\d{1,14} = min 2 digits
    const res = await PATCH(makeReq("PATCH", { phone: "+1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone has letters", async () => {
    const res = await PATCH(makeReq("PATCH", { phone: "+91abc123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when avatar_url uses http (not https)", async () => {
    const res = await PATCH(makeReq("PATCH", {
      avatar_url: "http://abcdefgh.supabase.co/storage/v1/object/public/avatars/pic.png",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when avatar_url is not on supabase.co", async () => {
    const res = await PATCH(makeReq("PATCH", {
      avatar_url: "https://example.com/avatar.png",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when avatar_url is not a valid URL", async () => {
    const res = await PATCH(makeReq("PATCH", { avatar_url: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  // ── Auth & server errors ───────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "Not authenticated" } });
    const res = await PATCH(makeReq("PATCH", { full_name: "Name" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 on Supabase DB error", async () => {
    updateChain({ error: { code: "PGRST204", message: "Could not find column 'phone'" } });
    const res = await PATCH(makeReq("PATCH", { full_name: "Name" }));
    expect(res.status).toBe(500);
  });

  it("does not leak DB error message to client on 500", async () => {
    updateChain({ error: { code: "PGRST204", message: "Could not find column 'phone'" } });
    const res = await PATCH(makeReq("PATCH", { full_name: "Name" }));
    const body = await res.json();
    expect(body.error.message).not.toMatch(/pgrst/i);
    expect(body.error.message).not.toMatch(/column/i);
    expect(body.error.message).not.toMatch(/phone/i);
  });

  it("response is JSON", async () => {
    updateChain({ error: null });
    const res = await PATCH(makeReq("PATCH", { full_name: "Name" }));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});
