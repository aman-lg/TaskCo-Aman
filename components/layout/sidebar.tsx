"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Clock, ChevronLeft, ChevronRight,
  User, Video, Bell, LogOut, Loader2, Settings, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/projects",   label: "Projects",   icon: FolderKanban },
  { href: "/meetings",   label: "Meetings",   icon: Video },
  { href: "/attendance", label: "Attendance", icon: Clock },
];

const W = 240;   // expanded
const WC = 64;   // collapsed

// Sidebar-specific colour palette — dark navy shell, theme-independent
const C = {
  bg:         "#19183B",
  active:     "rgba(255,255,255,0.11)",
  hover:      "rgba(255,255,255,0.06)",
  pill:       "#CE7E37",
  textOn:     "#FFFFFF",
  textOff:    "rgba(255,255,255,0.55)",
  textMuted:  "rgba(255,255,255,0.28)",
  divider:    "rgba(255,255,255,0.08)",
  profileBg:  "rgba(255,255,255,0.07)",
  iconOff:    "rgba(255,255,255,0.48)",
  iconOn:     "rgba(255,255,255,0.92)",
  redIcon:    "#F87171",
};

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  profile?: { name: string | null; email: string | null; avatar: string | null } | null;
  isAdmin?: boolean;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

export function Sidebar({
  collapsed, onToggle, mobileOpen = false, onMobileClose,
  profile, isAdmin = false, onSignOut, isSigningOut,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  // Common icon-button style for utility row
  const iconBtn = (active = false) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    border: "none",
    transition: "background 120ms",
    background: active ? C.active : "transparent",
    color: active ? C.iconOn : C.iconOff,
  } as React.CSSProperties);

  return (
    <TooltipProvider delay={0}>
      <aside
        style={{
          width: collapsed ? WC : W,
          background: C.bg,
          boxShadow: "4px 0 32px rgba(0,0,0,0.22)",
          transition: "width 220ms cubic-bezier(.4,0,.2,1)",
        }}
        className={cn(
          "fixed top-0 left-0 h-full z-40 flex flex-col overflow-hidden select-none",
          !mobileOpen && "max-md:-translate-x-full",
        )}
      >
        {/* ── Logo row ── */}
        <div
          className="flex items-center shrink-0"
          style={{ height: 60, padding: collapsed ? "0 14px" : "0 16px 0 20px", borderBottom: `1px solid ${C.divider}` }}
        >
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.pill }}>
                <span className="text-white font-black text-[13px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
              </div>
              <span className="font-bold text-[17px] leading-none" style={{ color: C.textOn, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                Task<span style={{ color: C.pill }}>Co</span>
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto flex-shrink-0" style={{ background: C.pill }}>
              <span className="text-white font-black text-[14px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
            </div>
          )}
          {!collapsed && (
            <Tooltip>
              <TooltipTrigger
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-colors"
                style={{ color: C.textMuted, background: "transparent" }}
                onClick={onToggle}
                aria-label="Collapse sidebar"
                onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ChevronLeft style={{ width: 15, height: 15 }} />
              </TooltipTrigger>
              <TooltipContent side="right">Collapse</TooltipContent>
            </Tooltip>
          )}
          {collapsed && (
            <Tooltip>
              <TooltipTrigger
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg mx-auto transition-colors"
                style={{ color: C.textMuted, background: "transparent" }}
                onClick={onToggle}
                aria-label="Expand sidebar"
                onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <ChevronRight style={{ width: 15, height: 15 }} />
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-4 flex flex-col">
          {!collapsed && (
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2 px-5" style={{ color: C.textMuted }}>
              Menu
            </p>
          )}
          <div className="flex flex-col gap-0.5 px-3">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");

              if (collapsed) {
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger
                      className="relative flex items-center justify-center w-10 h-10 rounded-xl mx-auto transition-all"
                      style={{ background: active ? C.active : "transparent", color: active ? C.textOn : C.textOff }}
                      onClick={() => { router.push(href); onMobileClose?.(); }}
                      aria-label={label}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.hover; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: C.pill }} />
                      )}
                      <Icon style={{ width: 17, height: 17 }} />
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
                  className="relative flex items-center gap-3 h-10 rounded-xl px-3 transition-all"
                  style={{
                    background: active ? C.active : "transparent",
                    color: active ? C.textOn : C.textOff,
                    fontWeight: active ? 600 : 500,
                    textDecoration: "none",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.hover; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style={{ background: C.pill }} />
                  )}
                  <Icon
                    className="flex-shrink-0"
                    style={{ width: 17, height: 17, color: active ? C.pill : C.textOff }}
                  />
                  <span style={{ fontSize: 14 }}>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ── Bottom: utility icons + profile ── */}
        <div className="shrink-0 flex flex-col gap-3 p-3" style={{ borderTop: `1px solid ${C.divider}` }}>

          {/* Utility icon row */}
          <div className={cn("flex gap-0.5 items-center", collapsed ? "flex-col" : "flex-row px-1")}>
            <div style={{ color: C.iconOff }}><ThemeToggle /></div>

            <Tooltip>
              <TooltipTrigger
                style={iconBtn()}
                onClick={() => router.push("/notifications")}
                aria-label="Notifications"
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.iconOn; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.iconOff; }}
              >
                <Bell style={{ width: 16, height: 16 }} />
              </TooltipTrigger>
              <TooltipContent side="right">Notifications</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                style={iconBtn()}
                onClick={() => router.push("/settings")}
                aria-label="Settings"
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.iconOn; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.iconOff; }}
              >
                <Settings style={{ width: 16, height: 16 }} />
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            {collapsed && (
              <Tooltip>
                <TooltipTrigger
                  style={{ ...iconBtn(), color: C.redIcon }}
                  onClick={onSignOut}
                  disabled={isSigningOut}
                  aria-label="Sign out"
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.13)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {isSigningOut
                    ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                    : <LogOut style={{ width: 15, height: 15 }} />}
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Profile card — expanded */}
          {profile && !collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2.5 w-full rounded-xl px-2.5 py-2.5 cursor-pointer transition-colors"
                style={{ background: C.profileBg }}
                onMouseEnter={e => (e.currentTarget.style.background = C.active)}
                onMouseLeave={e => (e.currentTarget.style.background = C.profileBg)}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile.avatar ?? undefined} alt={profile.name ?? "User"} />
                  <AvatarFallback className="text-[11px] font-bold text-white" style={{ background: C.pill }}>
                    {initials(profile.name, profile.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12.5px] font-semibold truncate leading-snug" style={{ color: C.textOn }}>
                    {profile.name ?? "User"}
                  </p>
                  <p className="text-[11px] truncate leading-snug" style={{ color: C.textOff }}>
                    {profile.email}
                  </p>
                </div>
                <ChevronRight style={{ width: 13, height: 13, color: C.textMuted, flexShrink: 0 }} />
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

          {/* Profile avatar — collapsed */}
          {profile && collapsed && (
            <Tooltip>
              <TooltipTrigger
                className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto transition-colors"
                style={{ background: C.profileBg }}
                onClick={() => router.push("/profile")}
                aria-label={profile.name ?? "Profile"}
                onMouseEnter={e => (e.currentTarget.style.background = C.active)}
                onMouseLeave={e => (e.currentTarget.style.background = C.profileBg)}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile.avatar ?? undefined} alt={profile.name ?? "User"} />
                  <AvatarFallback className="text-[11px] font-bold text-white" style={{ background: C.pill }}>
                    {initials(profile.name, profile.email)}
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
