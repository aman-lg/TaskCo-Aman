import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";

type SessionRow = { id: string; check_in_at: string; check_out_at: string | null; ist_date: string };

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

export const GET = withAuth(async (_req: NextRequest, { user }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const today = getISTDateString();

  const { data, error } = await db
    .from("attendance_sessions")
    .select("id, check_in_at, check_out_at, ist_date")
    .eq("user_id", user.id)
    .eq("ist_date", today)
    .order("check_in_at", { ascending: true });

  if (error) return ApiError.internal(error.message);

  const sessions = (data ?? []) as SessionRow[];
  const openSession = sessions.find((s) => !s.check_out_at) ?? null;

  const closedSeconds = sessions
    .filter((s) => s.check_out_at)
    .reduce((acc, s) => {
      const start = new Date(s.check_in_at).getTime();
      const end = new Date(s.check_out_at!).getTime();
      return acc + Math.floor((end - start) / 1000);
    }, 0);

  return ok({ sessions, openSession, closedSeconds, today });
});
