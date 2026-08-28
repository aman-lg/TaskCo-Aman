// SERVER ONLY — never import from "use client" files.
// Thin wrapper over the Drive v3 REST API — same fetch-only approach as
// lib/google/calendar.ts, no googleapis SDK. Uses the same connection/token
// as Calendar (GOOGLE_CALENDAR_SCOPE now includes drive.readonly).

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  size?: string;
  modifiedTime?: string;
}

export interface ListDriveFilesResult {
  files: DriveFile[];
  nextPageToken?: string;
}

export async function listDriveFiles(
  accessToken: string,
  { query, pageToken }: { query?: string; pageToken?: string } = {}
): Promise<ListDriveFilesResult> {
  const params = new URLSearchParams({
    fields: "nextPageToken, files(id, name, mimeType, iconLink, webViewLink, size, modifiedTime)",
    pageSize: "25",
    orderBy: "modifiedTime desc",
    spaces: "drive",
  });
  if (query) params.set("q", `trashed = false and name contains '${query.replace(/'/g, "\\'")}'`);
  else params.set("q", "trashed = false");
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Drive files.list failed (${res.status}): ${await res.text()}`);
  return res.json();
}
