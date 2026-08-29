"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NavProgress } from "@/components/layout/nav-progress";
import { GlobalSearch } from "@/components/layout/global-search";
import { useLogout } from "@/lib/hooks/use-logout";
import { useAttendanceAutoStart } from "@/lib/hooks/use-attendance-auto-start";

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
  const { logout, isLoading } = useLogout();
  const pathname = usePathname();
  const isChat = pathname?.startsWith("/chat") ?? false;
  // An open conversation (/chat/[id]) goes fullscreen on mobile — same as
  // WhatsApp hiding its own tab bar once you're inside a chat — the bare
  // list view (/chat) keeps the normal chrome.
  const isChatConversation = /^\/chat\/[^/]+/.test(pathname ?? "");
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

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        profile={profile}
        isAdmin={profile?.isAdmin ?? false}
        onSignOut={logout}
        isSigningOut={isLoading}
      />

      {!isChatConversation && (
        <MobileTopBar profile={profile} isAdmin={profile?.isAdmin ?? false} onSignOut={logout} isSigningOut={isLoading} />
      )}
      {!isChatConversation && <MobileBottomNav />}

      <main
        className={isChat ? "flex flex-col overflow-hidden" : "min-h-screen"}
        style={{
          "--sidebar-w": `${sidebarWidth}px`,
          transition: "margin-left 200ms ease",
          ...(isChat ? { height: "100vh" } : {}),
        } as React.CSSProperties}
      >
        <div className="md:ml-[var(--sidebar-w)] flex flex-col" style={isChat ? { height: "100%" } : undefined}>
          {isChat ? (
            <>
              {/* Mobile top offset — only when the mobile top bar is shown */}
              {!isChatConversation && <div className="md:hidden h-14 flex-shrink-0" />}
              <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
              {/* Bottom-nav clearance only on the conversation list, not inside an open chat */}
              {!isChatConversation && <div className="md:hidden h-[calc(56px+env(safe-area-inset-bottom))] flex-shrink-0" />}
            </>
          ) : (
            <>
              <div className="md:hidden h-14 flex-shrink-0" />
              <div className="px-4 py-6 md:px-10 md:py-8 max-w-[1200px] mx-auto w-full">{children}</div>
              <div className="md:hidden h-[calc(56px+env(safe-area-inset-bottom))] flex-shrink-0" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
