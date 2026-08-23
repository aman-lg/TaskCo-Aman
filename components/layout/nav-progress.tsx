"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear previous timers
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    // Reset and animate
    setWidth(0);
    setVisible(true);

    const t1 = setTimeout(() => setWidth(30), 10);
    const t2 = setTimeout(() => setWidth(70), 120);
    const t3 = setTimeout(() => setWidth(95), 350);
    const t4 = setTimeout(() => setWidth(100), 500);
    const t5 = setTimeout(() => setVisible(false), 750);

    timerRefs.current = [t1, t2, t3, t4, t5];
    return () => timerRefs.current.forEach(clearTimeout);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "var(--accent-brand)",
          transition: width === 0 ? "none" : "width 0.25s ease",
          boxShadow: "0 0 8px var(--accent-brand)",
        }}
      />
    </div>
  );
}
