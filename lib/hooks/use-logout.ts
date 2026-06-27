"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * useLogout — calls the server-side logout endpoint and redirects to /login.
 *
 * Why a dedicated POST endpoint instead of just supabase.auth.signOut() on the
 * client?  The Supabase SSR package sets HttpOnly cookies for the session.
 * Client-side JS cannot delete HttpOnly cookies, so a client-only sign-out
 * leaves the browser holding a cookie the middleware still considers valid.
 * The server-side route issues a proper Set-Cookie: Max-Age=0 header.
 */
export function useLogout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function logout() {
    if (isLoading) return; // prevent double-submit

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        // Credentials must be included so the browser sends the session cookie
        // with the request, allowing the server to identify which session to
        // invalidate before setting the clearing Set-Cookie header.
        credentials: "same-origin",
      });

      if (!res.ok) {
        throw new Error(`Logout request failed with status ${res.status}`);
      }

      // router.refresh() drops the client-side router cache before we navigate.
      // Without this, Next.js may serve a stale cached layout that still shows
      // the authenticated user's data on the next /login visit.
      router.refresh();
      router.push("/login");
    } catch (err) {
      console.error("[useLogout]", err);
      toast.error("Failed to sign out. Please try again.");
      setIsLoading(false); // only reset on error — success navigates away
    }
  }

  return { logout, isLoading };
}
