"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useLogout } from "@/lib/hooks/use-logout";

interface AppShellProfile {
  name: string | null;
  email: string | null;
  avatar: string | null;
}

interface AppShellProps {
  children: React.ReactNode;
  profile: AppShellProfile | null;
}

/**
 * AppShell — client boundary for the authenticated app layout.
 *
 * Owns sidebar collapse state and the logout action.  Kept as a separate
 * client component so the parent (app/(app)/layout.tsx) can remain a server
 * component and fetch the user once at layout render time instead of on every
 * client navigation.
 */
export function AppShell({ children, profile }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, isLoading } = useLogout();
  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--page-bg)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar
        sidebarWidth={sidebarWidth}
        user={profile ?? undefined}
        onSignOut={logout}
        isSigningOut={isLoading}
      />
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
