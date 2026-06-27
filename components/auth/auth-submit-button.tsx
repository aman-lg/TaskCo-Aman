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
        "w-full h-11 rounded-xl text-[14px] font-bold text-white",
        "flex items-center justify-center gap-2",
        "transition-[background-color,opacity,transform,box-shadow] duration-150 ease-out",
        "hover:brightness-110 active:scale-[0.98]",
        "disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(206,126,55,0.45)]",
        className
      )}
      style={{ backgroundColor: "var(--navy)" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? (loadingLabel ?? label) : label}
    </button>
  );
}
