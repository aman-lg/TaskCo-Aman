"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video, Clock, Network, Settings, User, LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/layout/notification-bell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name?: string | null, email?: string | null) {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

interface Props {
  profile?: { name: string | null; email: string | null; avatar: string | null } | null;
  isAdmin?: boolean;
  onSignOut?: () => void;
  isSigningOut?: boolean;
}

// Everything not in the bottom nav's four tabs (Meetings, Attendance, Org
// Chart, Settings, Profile) lives behind the avatar menu here — an overflow
// menu attached to something you'd tap anyway, rather than a hamburger
// opening a full drawer.
export function MobileTopBar({ profile, isAdmin = false, onSignOut, isSigningOut }: Props) {
  const router = useRouter();

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4"
      style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--line)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#CE7E37" }}>
          <span className="text-white font-black text-[12px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
        </div>
        <span className="font-bold text-[16px] leading-none" style={{ color: "var(--navy)", fontFamily: "var(--font-display)" }}>
          Task<span style={{ color: "var(--accent-d)" }}>Co</span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <NotificationBell variant="light" side="bottom" />
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full" aria-label="Menu">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar ?? undefined} alt={profile?.name ?? "User"} />
              <AvatarFallback className="text-[11px] font-bold text-white" style={{ background: "#CE7E37" }}>
                {initials(profile?.name, profile?.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/profile")}>
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/meetings")}>
              <Video className="h-4 w-4" /> Meetings
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/attendance")}>
              <Clock className="h-4 w-4" /> Attendance
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/org-chart")}>
              <Network className="h-4 w-4" /> Org Chart
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/admin")}>
                <ShieldCheck className="h-4 w-4" /> Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--clr-red)" }} onClick={onSignOut}>
              {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
