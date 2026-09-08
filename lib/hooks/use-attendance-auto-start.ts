"use client";

import { useEffect, useRef } from "react";

// Fires once per app session (after login) to ensure a work session is open.
// Silently calls clock-in if no session is running for today — unless the
// user has already marked today as a full-day leave in the worklog, in which
// case auto-clocking them in as "working" would be wrong. If the worklog
// prompt hasn't been answered yet, this proceeds as before (most days are
// working days, and it shouldn't block on an unanswered prompt).
export function useAttendanceAutoStart() {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function start() {
      try {
        const worklogRes = await fetch("/api/worklog/today", { credentials: "same-origin" });
        if (worklogRes.ok) {
          const { data } = await worklogRes.json();
          if (data?.entry?.presence_type === "leave_full") return;
        }

        const res = await fetch("/api/attendance/today", { credentials: "same-origin" });
        if (!res.ok) return;
        const { data } = await res.json();
        if (!data?.openSession) {
          await fetch("/api/attendance/clock-in", {
            method: "POST",
            credentials: "same-origin",
          });
        }
      } catch {
        // Silently ignore — attendance is non-critical
      }
    }

    start();
  }, []);
}
