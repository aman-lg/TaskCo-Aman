"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--page-bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar sidebarWidth={sidebarWidth} />
      <main
        className="pt-[60px] min-h-screen"
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 200ms ease",
        }}
      >
        <div className="px-6 py-6 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
