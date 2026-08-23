"use client";

import { useEffect, useRef } from "react";

// Fires once per app session (after login) to ensure a work session is open.
// Silently calls clock-in if no session is running for today.
export function useAttendanceAutoStart() {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    async function start() {
      try {
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
