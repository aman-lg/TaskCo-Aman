import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

function getISTDateString() {
  return new Date()
    .toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .reverse()
    .join("-");
}

export const POST = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const today = getISTDateString();

  // Find any open session for this user
  const { data: openSessions } = await db
    .from("attendance_sessions")
    .select("id, ist_date")
    .eq("user_id", user.id)
    .is("check_out_at", null);

  if (openSessions && openSessions.length > 0) {
    const todayOpen = openSessions.find((s: { ist_date: string }) => s.ist_date === today);
    if (todayOpen) {
      // Already clocked in today — return the existing session (idempotent)
      const { data: existing } = await db
        .from("attendance_sessions")
        .select("id, check_in_at, check_out_at, ist_date")
        .eq("id", todayOpen.id)
        .single();
      return ok(existing, 200);
    }
    // Stale open sessions from previous days — auto-close them
    const staleIds = openSessions
      .filter((s: { ist_date: string }) => s.ist_date !== today)
      .map((s: { id: string }) => s.id);
    if (staleIds.length > 0) {
      await db
        .from("attendance_sessions")
        .update({ check_out_at: new Date().toISOString() })
        .in("id", staleIds);
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("attendance_sessions")
    .insert({ user_id: user.id, check_in_at: now, ist_date: today })
    .select("id, check_in_at, check_out_at, ist_date")
    .single();

  if (error) { console.error("[attendance/clock-in]", error); return ApiError.internal(); }
  return ok(data, 201);
});
