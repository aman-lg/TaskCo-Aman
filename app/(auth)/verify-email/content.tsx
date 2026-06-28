"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
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
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Icon */}
      <div className="mb-7 flex flex-col items-center text-center anim-scale-in">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: "var(--navy-l)" }}
        >
          <Mail className="h-7 w-7" style={{ color: "var(--navy)" }} />
        </div>

        <p className="eyebrow mb-1.5" style={{ color: "var(--accent-brand)" }}>
          One more step
        </p>
        <h1 className="h1">Check your email</h1>
        <p className="mt-2 text-[13px] leading-relaxed max-w-[320px]" style={{ color: "var(--text-secondary)" }}>
          We sent a verification link to{" "}
          {email ? (
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{email}</span>
          ) : (
            "your email address"
          )}
          . Click the link to activate your account.
        </p>
      </div>

      {/* Steps */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-col gap-3 anim-fade-up anim-d-200"
        style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
      >
        {[
          "Open your inbox and find the email from TaskCo",
          "Click the \"Verify email\" button inside",
          "You'll be logged in automatically",
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
              style={{ background: "var(--navy)", color: "#fff" }}
            >
              {i + 1}
            </span>
            <span className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>{step}</span>
          </div>
        ))}
      </div>

      {/* Resend */}
      {email && (
        <div className="mb-6 text-center anim-fade-in anim-d-300">
          {sent ? (
            <span className="flex items-center justify-center gap-2 text-[13px]" style={{ color: "var(--clr-green)" }}>
              <CheckCircle className="h-4 w-4" />
              Email sent — check your inbox
            </span>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={resend}
                disabled={loading}
                className="font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: "var(--navy)" }}
              >
                {loading ? "Sending…" : "resend the email"}
              </button>
            </p>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="flex items-center justify-center gap-5 text-[13px] anim-fade-in anim-d-400">
        <Link
          href="/login"
          className="flex items-center gap-1.5 font-semibold hover:underline"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
        <span style={{ color: "var(--line)" }}>·</span>
        <Link
          href="/register"
          className="font-semibold hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          Use a different email
        </Link>
      </div>
    </>
  );
}
