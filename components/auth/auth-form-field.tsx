"use client";

import { type InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthFormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** placeholder prop is intentionally ignored — the floating label IS the placeholder */
  placeholder?: string;
}

/**
 * AuthFormField — floating-label input following the design system spec (§5).
 *
 * Label behaviour:
 *   Resting  → centered inside the input, acts as a visual placeholder
 *   Lifted   → top-left at 10px, 10.5px/700, letter-spaced; triggered by
 *              focus OR non-empty value (:not(:placeholder-shown) CSS trick)
 *
 * The `placeholder` prop from the caller is discarded. A single-space
 * placeholder " " is set on the <input> so CSS :not(:placeholder-shown)
 * can fire correctly when the user has typed a value.
 */
export const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
  ({ label, error, hint, type, className, id, placeholder: _ignored, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType  = isPassword && showPassword ? "text" : type;

    return (
      <div className="flex flex-col gap-1.5">

        {/* Wrapper provides position:relative for label + toggle */}
        <div className="float-label-wrap">
          <input
            ref={ref}
            id={id}
            type={inputType}
            /* Single space — transparent via CSS, triggers :not(:placeholder-shown) */
            placeholder=" "
            className={cn(
              "float-label-input",
              error      && "error-state",
              isPassword && "has-toggle",
              className
            )}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            aria-invalid={!!error}
            {...props}
          />

          {/* Label MUST follow <input> in the DOM — CSS uses the ~ sibling selector */}
          <label htmlFor={id} className="float-label">
            {label}
          </label>

          {isPassword && (
            <button
              type="button"
              className="float-label-toggle"
              onClick={() => setShowPassword((v) => !v)}
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
            id={`${id}-error`}
            role="alert"
            className="text-[12px] font-semibold"
            style={{ color: "var(--clr-red)" }}
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${id}-hint`}
            className="text-[12px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
AuthFormField.displayName = "AuthFormField";
