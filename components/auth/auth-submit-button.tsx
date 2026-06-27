"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps {
  loading: boolean;
  label: string;
  loadingLabel?: string;
  className?: string;
}

export function AuthSubmitButton({ loading, label, loadingLabel, className }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "w-full h-10 rounded-lg text-sm font-bold text-white transition-opacity flex items-center justify-center gap-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
      style={{ backgroundColor: "var(--navy)" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (loadingLabel ?? label) : label}
    </button>
  );
}
