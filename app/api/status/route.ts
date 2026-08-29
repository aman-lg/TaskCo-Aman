import { NextResponse } from "next/server";
import { runAllChecks, type CheckStatus } from "@/lib/status/checks";

export const dynamic = "force-dynamic";

// GET /api/status — deliberately NOT behind withAuth(): this is the public
// status page's data source, so it has to be callable by a signed-out
// visitor. It only ever returns aggregate up/down info, never any real data.
export async function GET() {
  const checks = await runAllChecks();

  const overall: CheckStatus = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";

  return NextResponse.json({
    overall,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
