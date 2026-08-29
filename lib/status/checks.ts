// SERVER ONLY — never import from "use client" files.
// Each check is a live, real network call to the actual service (never a
// hardcoded "operational") — timed out and try/caught individually so one
// slow/broken service can't take the others down with it. None of these
// call anything billed per-use (Gemini's models endpoint and Daily's rooms
// endpoint are metadata reads, not generateContent) — safe to hit on every
// page load of a public status page.

import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

export type CheckStatus = "operational" | "degraded" | "down";

export interface CheckResult {
  key: string;
  name: string;
  description: string;
  status: CheckStatus;
  message: string;
  latencyMs: number | null;
}

const TIMEOUT_MS = 6000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: unknown; latencyMs: number }> {
  const start = Date.now();
  try {
    const data = await fn();
    return { data, error: null, latencyMs: Date.now() - start };
  } catch (error) {
    return { data: null, error, latencyMs: Date.now() - start };
  }
}

// ─── Database, Auth & Chat ─────────────────────────────────────────────────
// Chat/messages live on the same Postgres instance — this is the one check
// that stands in for all of them, not a separate probe for each.

async function checkDatabase(): Promise<CheckResult> {
  const base = { key: "database", name: "Database, Auth & Chat", description: "Core Postgres database, authentication, and messaging." };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { ...base, status: "down", message: "Not configured", latencyMs: null };

  const { error, latencyMs } = await timed(() =>
    withTimeout(async (signal) => {
      const client = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
      const { error } = await client.from("profiles").select("id", { count: "exact", head: true }).abortSignal(signal);
      if (error) throw error;
    })
  );

  if (error) return { ...base, status: "down", message: "Unreachable", latencyMs };
  if (latencyMs > 2500) return { ...base, status: "degraded", message: `Slow (${latencyMs}ms)`, latencyMs };
  return { ...base, status: "operational", message: "Operational", latencyMs };
}

// ─── Ask Tasko (Gemini) ─────────────────────────────────────────────────────

async function checkGemini(): Promise<CheckResult> {
  const base = { key: "gemini", name: "Ask Tasko (AI Assistant)", description: "The Gemini API that powers Ask Tasko and AI insights." };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ...base, status: "down", message: "API key not configured", latencyMs: null };

  const { data, error, latencyMs } = await timed(() =>
    withTimeout((signal) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { signal })
    )
  );

  if (error) return { ...base, status: "down", message: "Unreachable", latencyMs };
  const res = data!;
  if (res.status === 429) return { ...base, status: "degraded", message: "Rate limited / quota", latencyMs };
  if (!res.ok) return { ...base, status: "down", message: `Error (${res.status})`, latencyMs };
  return { ...base, status: "operational", message: "Operational", latencyMs };
}

// ─── Voice Calls (Daily.co) ─────────────────────────────────────────────────

async function checkDaily(): Promise<CheckResult> {
  const base = { key: "daily", name: "Voice Calls", description: "Daily.co, used for in-app voice calls." };
  const key = process.env.DAILY_API_KEY;
  if (!key) return { ...base, status: "down", message: "API key not configured", latencyMs: null };

  const { data, error, latencyMs } = await timed(() =>
    withTimeout((signal) =>
      fetch("https://api.daily.co/v1/rooms?limit=1", { headers: { Authorization: `Bearer ${key}` }, signal })
    )
  );

  if (error) return { ...base, status: "down", message: "Unreachable", latencyMs };
  const res = data!;
  if (!res.ok) return { ...base, status: "down", message: `Error (${res.status})`, latencyMs };
  return { ...base, status: "operational", message: "Operational", latencyMs };
}

// ─── File Storage ───────────────────────────────────────────────────────────

async function checkStorage(): Promise<CheckResult> {
  const base = { key: "storage", name: "File Storage", description: "Supabase Storage, used for attachments and voice notes." };
  const { error, latencyMs } = await timed(() =>
    withTimeout(async () => {
      const admin = createAdminClient();
      const { error } = await admin.storage.listBuckets();
      if (error) throw error;
    })
  );

  if (error) return { ...base, status: "down", message: "Unreachable", latencyMs };
  return { ...base, status: "operational", message: "Operational", latencyMs };
}

// ─── Google Calendar & Drive ─────────────────────────────────────────────────
// There's no single "is Google Calendar down" check that doesn't depend on a
// specific user's own OAuth token — this checks the two things that actually
// are global: our client credentials are configured, and Google's own OAuth
// infrastructure is reachable at all.

async function checkGoogle(): Promise<CheckResult> {
  const base = { key: "google", name: "Google Calendar & Drive", description: "Google OAuth connection used for Calendar sync, meeting links, and Drive attachments." };
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { ...base, status: "down", message: "Not configured", latencyMs: null };

  const { data, error, latencyMs } = await timed(() =>
    withTimeout((signal) => fetch("https://accounts.google.com/.well-known/openid-configuration", { signal }))
  );

  if (error) return { ...base, status: "down", message: "Unreachable", latencyMs };
  if (!data!.ok) return { ...base, status: "degraded", message: `Google reporting issues (${data!.status})`, latencyMs };
  return { ...base, status: "operational", message: "Operational", latencyMs };
}

export async function runAllChecks(): Promise<CheckResult[]> {
  const results = await Promise.allSettled([
    checkDatabase(),
    checkGemini(),
    checkGoogle(),
    checkDaily(),
    checkStorage(),
  ]);

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // A check function itself throwing (rather than returning a "down"
    // result) is itself a bug — still report something rather than 500ing
    // the whole status page over it.
    const names = ["database", "gemini", "google", "daily", "storage"];
    return {
      key: names[i],
      name: names[i],
      description: "",
      status: "down" as const,
      message: "Check failed unexpectedly",
      latencyMs: null,
    };
  });
}
