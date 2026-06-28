"use client";

import { useState } from "react";
import { CountryCodeSelect } from "@/components/profile/country-code-select";

interface Props {
  countryCode: string;
  localPhone: string;
  onCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  error?: string | null;
}

export function AuthPhoneField({ countryCode, localPhone, onCodeChange, onPhoneChange, error }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        {/* Outer wrapper matches float-label-input dimensions exactly */}
        <div
          className="flex items-stretch w-full overflow-hidden"
          style={{
            height: 56,
            border: `1px solid ${error ? "var(--clr-red)" : focused ? "var(--navy)" : "var(--line)"}`,
            borderRadius: 10,
            background: error
              ? "color-mix(in srgb, var(--clr-red-bg) 40%, var(--surface-bg))"
              : "var(--panel-bg)",
            boxShadow: focused
              ? error
                ? "0 0 0 3px rgba(220, 38, 38, 0.12)"
                : "0 0 0 3px rgba(161, 194, 189, 0.28)"
              : "none",
            transition: "border-color 150ms, box-shadow 150ms",
          }}
        >
          {/* Country code trigger — no border, transparent, full height */}
          <CountryCodeSelect
            value={countryCode}
            onChange={onCodeChange}
            insideField
          />

          {/* Vertical divider */}
          <div
            className="flex-shrink-0 self-center"
            style={{ width: 1, height: 24, background: "var(--line)" }}
          />

          {/* Number input — padded top so text sits below the lifted label */}
          <input
            type="tel"
            value={localPhone}
            onChange={e => onPhoneChange(e.target.value.replace(/\D/g, ""))}
            placeholder=" "
            maxLength={15}
            autoComplete="tel"
            className="flex-1 min-w-0 bg-transparent outline-none"
            style={{
              fontSize: 15,
              color: "var(--ink)",
              caretColor: "var(--navy)",
              padding: "0 14px",
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Phone number"
          />
        </div>

      </div>

      {error && (
        <p className="text-[12px] font-semibold" style={{ color: "var(--clr-red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
