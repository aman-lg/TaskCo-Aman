"use client";

import Link from "next/link";
import { Bell, Loader2, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface TopbarProps {
  sidebarWidth: number;
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  unreadCount?: number;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function Topbar({ sidebarWidth, user, unreadCount = 0, onSignOut, isSigningOut = false }: TopbarProps) {
  const router = useRouter();

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center h-[60px] px-4 gap-2"
      style={{
        left: sidebarWidth,
        backgroundColor: "var(--shell-bg)",
        borderBottom: "1px solid var(--line)",
        transition: "left 200ms ease",
      }}
    >
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative"
          aria-label="Notifications"
          onClick={() => router.push("/notifications")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold flex items-center justify-center rounded-full border-0"
              style={{ backgroundColor: "var(--accent-brand)", color: "#fff" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-9 w-9 p-0 rounded-full flex items-center justify-center"
            aria-label="Profile menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar ?? undefined} alt={user?.name ?? "User"} />
              <AvatarFallback
                className="text-xs font-bold text-white"
                style={{ backgroundColor: "var(--navy)" }}
              >
                {getInitials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {user && (
              <>
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {user.name ?? "User"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => router.push("/profile")}
            >
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => router.push("/settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              style={{ color: "var(--clr-red)" }}
              onClick={onSignOut}
              disabled={isSigningOut}
              aria-label="Sign out"
            >
              {isSigningOut
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <LogOut  className="h-4 w-4" />
              }
              {isSigningOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
