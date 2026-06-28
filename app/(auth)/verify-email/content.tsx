"use client";

import { useSearchParams } from "next/navigation";

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div>
      <p className="eyebrow mb-1">Almost there</p>
      <h1 className="h1" style={{ color: "var(--ink)" }}>Verify your email</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        We sent a verification link to{" "}
        {email ? (
          <span className="font-semibold" style={{ color: "var(--ink)" }}>{email}</span>
        ) : (
          "your email address"
        )}
        . Click the link to activate your account.
      </p>
    </div>
  );
}
