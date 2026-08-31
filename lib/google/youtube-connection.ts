// SERVER ONLY — never import from "use client" files.
// OAuth2 helpers for the YouTube connection — deliberately separate from
// lib/google/calendar.ts's connection even though both talk to Google: this
// is a distinct scope, a distinct token store (youtube_connections, org-wide
// singleton), and a distinct redirect URI, not another grant bolted onto
// every employee's personal Calendar connection.

import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// youtube.readonly covers channel/video metadata (Data API v3);
// yt-analytics.readonly is required separately for impressions/CTR, which
// aren't exposed by the public Data API at all.
export const YOUTUBE_SCOPE =
  "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getYoutubeAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// One connection, org-wide (no userId param — unlike Calendar's
// getValidAccessToken, this isn't scoped per employee).
export async function getValidYoutubeAccessToken(): Promise<string | null> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (admin as any)
    .from("youtube_connections")
    .select("id, access_token, refresh_token, token_expiry")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) return null;

  const expiryMs = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0;
  const stillValid = conn.access_token && expiryMs - Date.now() > 60_000;
  if (stillValid) return conn.access_token;

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("youtube_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry, updated_at: new Date().toISOString() })
    .eq("id", conn.id);

  return refreshed.access_token;
}
