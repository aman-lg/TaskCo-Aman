"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Mail, CheckCircle } from "lucide-react";
import { z } from "zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

type Mode = "password" | "otp";

const otpSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type OtpInput = z.infer<typeof otpSchema>;

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _redirectTo = searchParams.get("redirectTo");
  const redirectTo = _redirectTo?.startsWith("/") && !_redirectTo.startsWith("//") ? _redirectTo : "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  // ── Password form ─────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // ── OTP form ──────────────────────────────────────────────────────────────
  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors },
  } = useForm<OtpInput>({ resolver: zodResolver(otpSchema) });

  async function onPasswordSubmit(values: LoginInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
        } else if (error.message.toLowerCase().includes("invalid login")) {
          toast.error("Incorrect email or password.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      // Block unverified users even if Supabase's "confirm email" setting is off
      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onOtpSubmit(values: OtpInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("signups not allowed")) {
          toast.error("No account found with this email. Please register first.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      setOtpEmail(values.email);
      setOtpSent(true);
    } finally {
      setLoading(false);
    }
  }

  // ── OTP sent state ────────────────────────────────────────────────────────
  if (otpSent) {
    return (
      <div className="flex flex-col items-center text-center gap-5 anim-scale-in">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: "var(--navy-l)" }}
        >
          <CheckCircle className="h-7 w-7" style={{ color: "var(--navy)" }} />
        </div>
        <div>
          <h1 className="h2">Check your inbox</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We sent a sign-in link to{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{otpEmail}</span>.
            Click the link to sign in — no password needed.
          </p>
        </div>
        <button
          onClick={() => { setOtpSent(false); setMode("password"); }}
          className="text-[13px] font-semibold hover:underline"
          style={{ color: "var(--navy)" }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 anim-fade-up anim-d-150">
        <p className="eyebrow mb-1.5">Welcome back</p>
        <h1 className="h1">Sign in</h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Enter your credentials to access your workspace.
        </p>
      </div>

      {/* Mode toggle */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl mb-5 anim-fade-up anim-d-150"
        style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}
      >
        {(["password", "otp"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="flex-1 h-8 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              background: mode === m ? "var(--navy)" : "transparent",
              color: mode === m ? "#fff" : "var(--text-muted)",
            }}
          >
            {m === "password" ? "Password" : "Email link"}
          </button>
        ))}
      </div>

      {/* Password mode */}
      {mode === "password" && (
        <form onSubmit={handleSubmit(onPasswordSubmit)} noValidate className="flex flex-col gap-4">
          <div className="anim-fade-up anim-d-200">
            <AuthFormField
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>
          <div className="anim-fade-up anim-d-250">
            <AuthFormField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>
          <div className="flex items-center justify-end anim-fade-in anim-d-300">
            <Link
              href="/forgot-password"
              className="text-[12px] font-semibold hover:underline"
              style={{ color: "var(--navy)" }}
            >
              Forgot password?
            </Link>
          </div>
          <div className="anim-fade-up anim-d-300">
            <AuthSubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
          </div>
        </form>
      )}

      {/* OTP / magic-link mode */}
      {mode === "otp" && (
        <form onSubmit={handleOtpSubmit(onOtpSubmit)} noValidate className="flex flex-col gap-4">
          <div className="anim-fade-up anim-d-200">
            <div
              className="flex items-start gap-3 p-3 rounded-xl mb-1"
              style={{ background: "var(--navy-l)", border: "1px solid var(--line-soft)" }}
            >
              <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--navy)" }} />
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--navy)" }}>
                We&apos;ll send a one-click sign-in link to your email. No password needed.
              </p>
            </div>
          </div>
          <div className="anim-fade-up anim-d-250">
            <AuthFormField
              id="otp-email"
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={otpErrors.email?.message}
              {...registerOtp("email")}
            />
          </div>
          <div className="anim-fade-up anim-d-300">
            <AuthSubmitButton loading={loading} label="Send sign-in link" loadingLabel="Sending…" />
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-[13px] anim-fade-in anim-d-400" style={{ color: "var(--text-secondary)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Create one
        </Link>
      </p>
    </>
  );
}
