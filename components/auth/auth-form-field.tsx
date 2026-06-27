"use client";

import { type InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
  ({ label, error, hint, type, className, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword && showPassword ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-sm font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={inputType}
            className={cn(
              "w-full h-10 px-3 rounded-lg text-sm font-medium outline-none transition-all",
              "placeholder:text-[var(--text-placeholder)]",
              error
                ? "border-[1.5px] border-[var(--clr-red)] focus:ring-2 focus:ring-[var(--clr-red-bg)]"
                : "border-[1.5px] border-[var(--line)] focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy-50)]",
              isPassword && "pr-10",
              className
            )}
            style={{ backgroundColor: "var(--surface-bg)", color: "var(--ink)" }}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
              style={{ color: "var(--text-muted)" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium" style={{ color: "var(--clr-red)" }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);
AuthFormField.displayName = "AuthFormField";
