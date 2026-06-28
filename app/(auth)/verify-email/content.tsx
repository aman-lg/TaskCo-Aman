"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    if (!email) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) {
        toast.error("Something went wrong. Please try again.");
      } else {
        setSent(true);
        toast.success("Verification email resent!");
      }
    } finally {
      setLoading(false);
    }
  }

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
      {email && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Didn&apos;t receive it?
          </span>
          <button
            onClick={resend}
            disabled={loading || sent}
            className="text-[13px] font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "var(--navy)" }}
          >
            {loading ? "Sending…" : sent ? "Email sent ✓" : "Resend email"}
          </button>
        </div>
      )}
    </div>
  );
}
