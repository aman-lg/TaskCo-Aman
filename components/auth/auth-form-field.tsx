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
          className="text-[13px] font-semibold"
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
              "w-full h-11 px-3.5 rounded-xl text-[14px] font-medium outline-none",
              "placeholder:text-[var(--text-placeholder)] placeholder:font-normal",
              "transition-[border-color,box-shadow] duration-150 ease-out",
              error
                ? "border-[1.5px] border-[var(--clr-red)] bg-[var(--clr-red-bg)]/30 focus:border-[var(--clr-red)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]"
                : "border-[1.5px] border-[var(--line)] bg-[var(--surface-bg)] hover:border-[var(--text-muted)] focus:border-[var(--navy)] focus:shadow-[0_0_0_3px_rgba(16,18,90,0.10)]",
              isPassword && "pr-11",
              className
            )}
            style={{ color: "var(--ink)" }}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-100"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword
                ? <EyeOff className="h-[18px] w-[18px]" />
                : <Eye    className="h-[18px] w-[18px]" />
              }
            </button>
          )}
        </div>

        {error && (
          <p
            className="text-[12px] font-medium flex items-center gap-1"
            style={{ color: "var(--clr-red)" }}
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);
AuthFormField.displayName = "AuthFormField";
