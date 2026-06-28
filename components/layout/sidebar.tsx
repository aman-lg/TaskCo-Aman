"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/activity", label: "Activity", icon: Activity },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <TooltipProvider delay={0}>
      <aside
        style={{
          width: collapsed ? 72 : 240,
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid var(--line)",
          transition: "width 200ms ease",
        }}
        className="fixed top-0 left-0 h-full z-40 flex flex-col overflow-hidden"
      >
        {/* Logo */}
        <div
          className="flex items-center h-[60px] px-4 shrink-0"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <Link
            href="/dashboard"
            className="font-bold text-[17px] tracking-tight"
            style={{ color: "var(--navy)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
          >
            {collapsed ? "T" : (
              <>
                Task<span style={{ color: "var(--accent-d)" }}>Co</span>
              </>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger
                    className={cn(
                      "flex items-center justify-center h-10 w-10 mx-auto rounded-xl transition-colors cursor-pointer",
                      active
                        ? "text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]"
                    )}
                    style={active ? { backgroundColor: "var(--navy)" } : undefined}
                    onClick={() => { window.location.href = href; }}
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" />
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]"
                )}
                style={active ? { backgroundColor: "var(--navy)" } : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 shrink-0" style={{ borderTop: "1px solid var(--line)" }}>
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center h-9 rounded-xl text-sm font-medium transition-colors w-full",
              "text-[var(--text-muted)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]",
              collapsed ? "justify-center px-0" : "gap-3 px-3"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
