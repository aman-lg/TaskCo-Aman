"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { NavProgress } from "@/components/layout/nav-progress";
import { GlobalSearch } from "@/components/layout/global-search";
import { useLogout } from "@/lib/hooks/use-logout";
import { useAttendanceAutoStart } from "@/lib/hooks/use-attendance-auto-start";
import { Menu } from "lucide-react";

interface AppShellProfile {
  name: string | null;
  email: string | null;
  avatar: string | null;
  isAdmin?: boolean;
}

interface AppShellProps {
  children: React.ReactNode;
  profile: AppShellProfile | null;
}

export function AppShell({ children, profile }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, isLoading } = useLogout();
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat") ?? false;
  // Must match sidebar.tsx's own W/WC constants exactly — a mismatch here
  // (was 224 vs the sidebar's actual 240) let the expanded sidebar overlap
  // the first ~16px of main content, most visible on the chat page where
  // that content starts immediately with its own conversation list.
  const sidebarWidth = collapsed ? 64 : 240;

  // Auto clock-in once on first app load after login
  useAttendanceAutoStart();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--page-bg)" }}>
      <NavProgress />
      <GlobalSearch />
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        profile={profile}
        isAdmin={profile?.isAdmin ?? false}
        onSignOut={logout}
        isSigningOut={isLoading}
      />

      {/* Mobile header — hamburger only, no white bar on desktop */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center h-14 px-4"
        style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--line)" }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg"
          style={{ color: "var(--text-muted)" }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span
          className="ml-3 font-bold text-[17px]"
          style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}
        >
          Task<span style={{ color: "var(--accent-d)" }}>Co</span>
        </span>
      </div>

      <main
        className={isChat ? "flex flex-col overflow-hidden" : "min-h-screen"}
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 200ms ease",
          ...(isChat ? { height: "100vh" } : {}),
        }}
      >
        {/* Mobile top offset — only adds space when mobile header is visible */}
        {isChat ? (
          <>
            <div className="md:hidden h-14 flex-shrink-0" />
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </>
        ) : (
          <>
            <div className="md:hidden h-14 flex-shrink-0" />
            <div className="px-4 py-6 md:px-10 md:py-8 max-w-[1200px] mx-auto">{children}</div>
          </>
        )}
      </main>
    </div>
  );
}
