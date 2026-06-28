"use client";

import { useState, useEffect, useCallback } from "react";
import { Coffee, Square } from "lucide-react";

interface Session {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function apiFetch(url: string, method = "GET") {
  const res = await fetch(url, { method, credentials: "same-origin" });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

export function AttendanceTimer() {
  const [openSession, setOpenSession] = useState<Session | null>(null);
  const [closedSeconds, setClosedSeconds] = useState(0);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const applyState = useCallback((data: { openSession: Session | null; closedSeconds: number }) => {
    setOpenSession(data.openSession);
    setClosedSeconds(data.closedSeconds ?? 0);
    if (data.openSession) {
      setLiveSeconds(Math.floor((Date.now() - new Date(data.openSession.check_in_at).getTime()) / 1000));
    } else {
      setLiveSeconds(0);
    }
  }, []);

  // On mount: fetch today's state, auto clock-in if nothing is open
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const data = await apiFetch("/api/attendance/today");
      if (cancelled || !data) { setLoading(false); return; }
      if (!data.openSession) {
        await apiFetch("/api/attendance/clock-in", "POST");
        const data2 = await apiFetch("/api/attendance/today");
        if (!cancelled && data2) { applyState(data2); }
      } else {
        if (!cancelled) applyState(data);
      }
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [applyState]);

  // Live ticker while session is open
  useEffect(() => {
    if (!openSession) return;
    const tick = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [openSession]);

  async function clockOut() {
    setActionLoading(true);
    await apiFetch("/api/attendance/clock-out", "POST");
    const data = await apiFetch("/api/attendance/today");
    if (data) applyState(data);
    setActionLoading(false);
  }

  async function clockIn() {
    setActionLoading(true);
    await apiFetch("/api/attendance/clock-in", "POST");
    const data = await apiFetch("/api/attendance/today");
    if (data) applyState(data);
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="h-8 w-28 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.15)" }} />
        <div className="h-3 w-16 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
      </div>
    );
  }

  const isWorking = !!openSession;
  const totalSeconds = closedSeconds + liveSeconds;

  return (
    <div className="flex-shrink-0 flex flex-col items-end gap-1">
      {/* Time */}
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: isWorking ? "#4ade80" : "rgba(255,255,255,0.4)" }}
        />
        <span
          className="text-[26px] font-bold leading-none"
          style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-display)" }}
        >
          {formatDuration(totalSeconds)}
        </span>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 -mt-0.5">
        {isWorking ? "Working" : "On Break"} · Today
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1 mt-1">
        {isWorking ? (
          <>
            <button
              onClick={clockOut}
              disabled={actionLoading}
              title="Pause for break"
              className="flex items-center gap-1 h-6 px-2.5 rounded text-[11px] font-semibold transition-colors disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              <Coffee className="h-3 w-3" />
              Break
            </button>
            <button
              onClick={clockOut}
              disabled={actionLoading}
              title="End work day"
              className="flex items-center gap-1 h-6 px-2.5 rounded text-[11px] font-semibold transition-colors disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
            >
              <Square className="h-2.5 w-2.5" />
              End
            </button>
          </>
        ) : (
          <button
            onClick={clockIn}
            disabled={actionLoading}
            className="h-6 px-3 rounded text-[11px] font-semibold transition-colors disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
