"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  className?: string;
}

/**
 * AuthSubmitButton — primary action CTA following the design system spec (§5).
 *
 * Design rules applied:
 *   - Dark brand fill (#19183B) — high contrast, white text readable at all sizes
 *   - Pill radius (999px) — pill CTAs per design spec
 *   - --shadow-needle on hover — teal glow ring for active/CTA states
 *   - scale(0.98) on press — tactile press feedback
 *   - Loader2 spinner replaces icon slot while request is in-flight
 */
export function AuthSubmitButton({ loading, label, loadingLabel, className }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        /* Layout */
        "w-full h-12 rounded-full",
        "flex items-center justify-center gap-2",
        /* Typography */
        "text-[14px] font-bold text-white tracking-wide",
        /* Transitions — explicit properties, never `all` */
        "transition-[box-shadow,opacity,transform] duration-150 ease-out",
        /* States */
        "hover:shadow-[var(--shadow-needle)]",
        "active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(161,194,189,0.4)]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none",
        className
      )}
      style={{ backgroundColor: "var(--navy)" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (loadingLabel ?? label) : label}
    </button>
  );
}
