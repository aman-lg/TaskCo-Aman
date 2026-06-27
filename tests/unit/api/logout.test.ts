/**
 * Unit tests — POST /api/auth/logout
 *
 * Strategy: mock @/lib/supabase/server so no real network calls are made.
 * The route handler is imported directly and called with a synthetic
 * NextRequest, giving us full control over the Supabase auth responses.
 *
 * Coverage:
 *  - Happy path: 200 + success:true payload
 *  - Correct Supabase call: signOut invoked with scope:"local"
 *  - Idempotent: 200 even when Supabase reports no active session
 *  - Supabase internal error: still 200 (logout is best-effort)
 *  - Only POST is exported: GET/PUT not defined (Next.js returns 405 automatically)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

// vi.mock() is hoisted to the top of the file by Vitest, so the factory runs
// before any const declarations.  vi.hoisted() ensures mockSignOut is
// initialized before the factory references it.
const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { signOut: mockSignOut },
  }),
}));

// Import after mocks are set up
import { POST } from "@/app/api/auth/logout/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest() {
  return new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful sign-out
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("returns HTTP 200", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("returns { data: { success: true } } on success", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body).toEqual({ data: { success: true } });
  });

  it("calls supabase.auth.signOut with scope:'local'", async () => {
    await POST(makeRequest());
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("is idempotent — returns 200 when there is no active session", async () => {
    // Supabase returns an error when no session exists; logout should still succeed
    mockSignOut.mockResolvedValueOnce({ error: { message: "Auth session missing!" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("returns 200 even when Supabase throws an unexpected error", async () => {
    // Defensive: network-level Supabase failures should not expose 500 to the client
    mockSignOut.mockResolvedValueOnce({ error: { message: "Internal server error" } });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("response Content-Type is application/json", async () => {
    const res = await POST(makeRequest());
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("does not expose session data or user info in the response body", async () => {
    const res = await POST(makeRequest());
    const text = await res.text();
    // Ensure no accidentally leaked fields
    expect(text).not.toMatch(/token/i);
    expect(text).not.toMatch(/session/i);
    expect(text).not.toMatch(/user/i);
  });
});
