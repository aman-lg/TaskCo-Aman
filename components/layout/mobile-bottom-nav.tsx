"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListTodo, MessageSquare } from "lucide-react";
import { useChatUnread } from "@/lib/hooks/use-chat-unread";

// WhatsApp-style: icon + label bottom tabs, exactly these four (per explicit
// request) — everything else lives behind the mobile top bar's avatar menu
// instead of a fifth+ tab or a hamburger drawer.
const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const chatUnread = useChatUnread();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
      style={{
        background: "var(--sidebar-bg)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
        const badge = href === "/chat" ? chatUnread : 0;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
            style={{ color: active ? "var(--navy)" : "var(--text-muted)" }}
          >
            <span className="relative">
              <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
              {badge > 0 && (
                <span
                  className="absolute -top-1 -right-2 flex items-center justify-center text-[9px] font-bold text-white rounded-full"
                  style={{ minWidth: 15, height: 15, padding: "0 3px", background: "#ef4444" }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span className="text-[10.5px]" style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
