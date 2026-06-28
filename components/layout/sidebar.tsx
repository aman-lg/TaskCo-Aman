"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  Video,
  Bell,
  LogOut,
  Loader2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/projects",   label: "Projects",   icon: FolderKanban },
  { href: "/meetings",   label: "Meetings",   icon: Video },
  { href: "/attendance", label: "Attendance", icon: Clock },
];

// Sidebar is 224px. Items are 192px → 16px equal margin each side.
const ITEM_W = 192;
// Collapsed sidebar is 64px. Icons are 36px → 14px each side.
const ICON_W = 36;

function getInitials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  profile?: { name: string | null; email: string | null; avatar: string | null } | null;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

export function Sidebar({
  collapsed, onToggle, mobileOpen = false, onMobileClose,
  profile, onSignOut, isSigningOut,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const iconBtn = "flex items-center justify-center rounded-lg transition-colors cursor-pointer text-[var(--text-muted)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]";

  return (
    <TooltipProvider delay={0}>
      <aside
        style={{
          width: collapsed ? 64 : 224,
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid var(--line)",
          transition: "width 200ms ease, transform 200ms ease",
        }}
        className={cn(
          "fixed top-0 left-0 h-full z-40 flex flex-col overflow-hidden",
          !mobileOpen && "max-md:-translate-x-full",
        )}
      >
        {/* ── Logo + collapse ── */}
        <div
          className="flex items-center h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--line)", padding: "0 14px" }}
        >
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex-1 font-bold text-[16px] leading-none"
              style={{ color: "var(--navy)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
            >
              Task<span style={{ color: "var(--accent-d)" }}>Co</span>
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger
              className={cn(iconBtn, "w-7 h-7 hidden md:flex", collapsed && "mx-auto")}
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"}</TooltipContent>
          </Tooltip>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 flex flex-col gap-0.5 py-1.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger
                    className={cn(
                      "flex items-center justify-center h-8 rounded-lg transition-colors cursor-pointer mx-auto",
                      active ? "text-white" : "text-[var(--text-secondary)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]"
                    )}
                    style={{ width: ICON_W, ...(active ? { backgroundColor: "var(--navy)" } : {}) }}
                    onClick={() => { window.location.href = href; }}
                    aria-label={label}
                  >
                    <Icon style={{ width: 16, height: 16 }} />
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 h-9 rounded-lg transition-colors mx-auto px-3",
                  active ? "text-white" : "text-[var(--text-secondary)] hover:bg-[var(--line-soft)] hover:text-[var(--ink)]"
                )}
                style={{ width: ITEM_W, ...(active ? { backgroundColor: "var(--navy)" } : {}) }}
              >
                <Icon className="flex-shrink-0" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14.5, fontWeight: 500 }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom section ── */}
        <div
          className="shrink-0 py-1.5 flex flex-col gap-1"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          {/* Action icons row */}
          {collapsed ? (
            <div className="flex flex-col items-center gap-0.5">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger className={cn(iconBtn, "w-8 h-8")} onClick={() => router.push("/notifications")} aria-label="Notifications">
                  <Bell style={{ width: 15, height: 15 }} />
                </TooltipTrigger>
                <TooltipContent side="right">Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger className={cn(iconBtn, "w-8 h-8")} onClick={() => router.push("/settings")} aria-label="Settings">
                  <Settings style={{ width: 15, height: 15 }} />
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  className={cn(iconBtn, "w-8 h-8 hover:bg-[var(--clr-red-bg)]")}
                  style={{ color: "var(--clr-red)" }}
                  onClick={onSignOut}
                  disabled={isSigningOut}
                  aria-label="Sign out"
                >
                  {isSigningOut
                    ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                    : <LogOut style={{ width: 15, height: 15 }} />}
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 mx-auto" style={{ width: ITEM_W }}>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger className={cn(iconBtn, "w-8 h-8")} onClick={() => router.push("/notifications")} aria-label="Notifications">
                  <Bell style={{ width: 15, height: 15 }} />
                </TooltipTrigger>
                <TooltipContent side="right">Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger className={cn(iconBtn, "w-8 h-8")} onClick={() => router.push("/settings")} aria-label="Settings">
                  <Settings style={{ width: 15, height: 15 }} />
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  className={cn(iconBtn, "w-8 h-8 hover:bg-[var(--clr-red-bg)]")}
                  style={{ color: "var(--clr-red)" }}
                  onClick={onSignOut}
                  disabled={isSigningOut}
                  aria-label="Sign out"
                >
                  {isSigningOut
                    ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                    : <LogOut style={{ width: 15, height: 15 }} />}
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Profile */}
          {profile && !collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2.5 h-9 rounded-lg transition-colors hover:bg-[var(--line-soft)] cursor-pointer mx-auto px-2"
                style={{ width: ITEM_W }}
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={profile.avatar ?? undefined} alt={profile.name ?? "User"} />
                  <AvatarFallback className="text-[11px] font-bold text-white" style={{ backgroundColor: "var(--navy)" }}>
                    {getInitials(profile.name, profile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: "var(--ink)" }}>
                    {profile.name ?? "User"}
                  </p>
                  <p className="text-[10px] truncate leading-tight" style={{ color: "var(--text-muted)" }}>
                    {profile.email}
                  </p>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/profile")}>
                  <User className="h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/settings")}>
                  <Settings className="h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--clr-red)" }} onClick={onSignOut}>
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {profile && collapsed && (
            <Tooltip>
              <TooltipTrigger
                className="flex items-center justify-center h-8 w-8 mx-auto rounded-lg transition-colors cursor-pointer hover:bg-[var(--line-soft)]"
                onClick={() => router.push("/profile")}
                aria-label={profile.name ?? "Profile"}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile.avatar ?? undefined} alt={profile.name ?? "User"} />
                  <AvatarFallback className="text-[10px] font-bold text-white" style={{ backgroundColor: "var(--navy)" }}>
                    {getInitials(profile.name, profile.email)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">{profile.name ?? "Profile"}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
