import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/api/handler";
import { ok, ApiError } from "@/lib/api/response";
import { todayISTDateString } from "@/lib/utils/dates-ist";

// GET /api/worklog/mine?month=YYYY-MM — the caller's own entries for a month
// (defaults to the current IST month), for their personal worklog history page.
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const monthParam = req.nextUrl.searchParams.get("month");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayISTDateString().slice(0, 7);

  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const to = `${nextMonth}-01`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;
  const { data, error } = await db
    .from("worklog_entries")
    .select("id, ist_date, presence_type, notes")
    .eq("user_id", user.id)
    .gte("ist_date", from)
    .lt("ist_date", to)
    .order("ist_date", { ascending: false });

  if (error) { console.error("[worklog/mine]", error); return ApiError.internal(); }
  return ok({ month, entries: data ?? [] });
});
