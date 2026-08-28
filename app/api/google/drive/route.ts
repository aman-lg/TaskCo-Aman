import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getValidAccessToken } from "@/lib/google/connection";
import { listDriveFiles } from "@/lib/google/drive";

// GET /api/google/drive?q=&pageToken=
// Browses the caller's own connected Google Drive (search by name). Returns
// a distinct "not_connected" code so the client can prompt to (re)connect —
// including users connected before the drive.readonly scope was added.
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const conn = await getValidAccessToken(user.id);
  if (!conn) return err("Google not connected", 400, "not_connected");

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const pageToken = searchParams.get("pageToken") ?? undefined;

  try {
    const result = await listDriveFiles(conn.accessToken, { query: q, pageToken });
    return ok(result);
  } catch (fetchErr) {
    console.error("[google/drive GET]", fetchErr);
    // A 403 here almost always means the stored token predates drive.readonly.
    return err("Reconnect Google to enable Drive access.", 400, "drive_scope_missing");
  }
});
