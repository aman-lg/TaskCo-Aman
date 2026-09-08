"use client";

import { useEffect, useRef, useState } from "react";
import type { WorklogPresenceType } from "@/lib/validations/worklog";

interface WorklogEntry {
  id: string;
  ist_date: string;
  presence_type: WorklogPresenceType;
  notes: string | null;
}

// Fires once per app session (mirrors useAttendanceAutoStart's mount-once
// pattern) to check whether today's presence has been marked yet.
export function useWorklogPrompt() {
  const didRun = useRef(false);
  const [needsPrompt, setNeedsPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        const res = await fetch("/api/worklog/today", { credentials: "same-origin" });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: { entry: WorklogEntry | null } };
        if (!data.entry) setNeedsPrompt(true);
      } catch {
        // Non-critical — just skip the prompt this session
      }
    })();
  }, []);

  async function mark(presenceType: WorklogPresenceType) {
    const res = await fetch("/api/worklog/mark", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presence_type: presenceType }),
    });
    if (res.ok) setNeedsPrompt(false);
    return res.ok;
  }

  return {
    show: needsPrompt && !dismissed,
    dismiss: () => setDismissed(true),
    mark,
  };
}
