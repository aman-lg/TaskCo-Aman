"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

// Shared by the desktop sidebar and the mobile bottom nav — both need the
// same "how many unread chat messages" badge count.
export function useChatUnread(): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    fetch("/api/chat/unread-count", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setCount(j.data.count ?? 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Hide the badge as soon as the user opens Chat, without waiting for the
  // next poll — they've just read the messages that made it non-zero.
  return pathname?.startsWith("/chat") ? 0 : count;
}
