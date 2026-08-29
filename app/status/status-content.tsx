"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowLeft } from "lucide-react";
import type { CheckResult, CheckStatus } from "@/lib/status/checks";

interface StatusResponse {
  overall: CheckStatus;
  checkedAt: string;
  checks: CheckResult[];
}

const POLL_MS = 30000;

const STATUS_META: Record<CheckStatus, { label: string; color: string; bg: string }> = {
  operational: { label: "Operational", color: "#16A34A", bg: "#EDF7ED" },
  degraded: { label: "Degraded", color: "#D97706", bg: "#FFF4E5" },
  down: { label: "Down", color: "#DC2626", bg: "#FDE8E8" },
};

function timeAgo(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  return `${Math.floor(diffSec / 60)}m ago`;
}

export function StatusContent() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      // best-effort — keep showing the last known state rather than nothing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    // Re-render every few seconds just to keep "X ago" fresh between polls.
    const tick = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [load]);

  const overall = data?.overall ?? "operational";
  const overallMeta = {
    operational: { label: "All Systems Operational", color: "#16A34A", bg: "#EDF7ED", Icon: CheckCircle2 },
    degraded: { label: "Partial System Outage", color: "#D97706", bg: "#FFF4E5", Icon: AlertTriangle },
    down: { label: "Major System Outage", color: "#DC2626", bg: "#FDE8E8", Icon: XCircle },
  }[overall];

  return (
    <div className="min-h-screen" style={{ background: "var(--page-bg)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface-bg)" }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#CE7E37" }}>
              <span className="text-white font-black text-[13px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
            </div>
            <span className="font-bold text-[16px] leading-none" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Task<span style={{ color: "#CE7E37" }}>Co</span>
            </span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 sm:py-14">
        <h1 className="text-[24px] sm:text-[28px] font-bold mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          System Status
        </h1>
        <p className="text-[13.5px] mb-8" style={{ color: "var(--text-muted)" }}>
          Live status of TaskCo's core services, checked automatically every 30 seconds.
        </p>

        {/* Overall banner */}
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-4 mb-8 border"
          style={{ background: loading ? "var(--surface-bg)" : overallMeta.bg, borderColor: "var(--line)" }}
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          ) : (
            <overallMeta.Icon className="w-5 h-5 flex-shrink-0" style={{ color: overallMeta.color }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold" style={{ color: loading ? "var(--text-muted)" : overallMeta.color, fontFamily: "var(--font-display)" }}>
              {loading ? "Checking…" : overallMeta.label}
            </p>
            {data && (
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                Last checked {timeAgo(data.checkedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); load(); }}
            disabled={loading}
            aria-label="Refresh"
            className="p-2 rounded-lg flex-shrink-0 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Service list */}
        <div className="flex flex-col gap-3">
          {(data?.checks ?? []).map((check) => {
            const meta = STATUS_META[check.status];
            return (
              <div
                key={check.key}
                className="flex items-center gap-4 rounded-xl px-5 py-4 border"
                style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{check.name}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{check.description}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                  {check.latencyMs != null && (
                    <span className="text-[11px] mt-1" style={{ color: "var(--text-fine)" }}>{check.latencyMs}ms</span>
                  )}
                </div>
              </div>
            );
          })}

          {!data && loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-xl px-5 py-4 border animate-pulse" style={{ background: "var(--surface-bg)", borderColor: "var(--line)", height: 64 }} />
              ))}
            </div>
          )}
        </div>

        <p className="text-[12px] text-center mt-8" style={{ color: "var(--text-fine)" }}>
          Each check calls the real service directly — nothing here is manually set.
        </p>
      </main>
    </div>
  );
}
