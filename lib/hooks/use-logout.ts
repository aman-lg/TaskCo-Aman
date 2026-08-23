"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function useLogout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function logout() {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      router.refresh();
      router.push("/login");
    } catch (err) {
      console.error("[useLogout]", err);
      toast.error("Failed to sign out. Please try again.");
      setIsLoading(false);
    }
  }

  return { logout, isLoading };
}
