"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSentEmail(values.email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-5 anim-scale-in">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: "var(--clr-green-bg)" }}
        >
          <CheckCircle className="h-7 w-7" style={{ color: "var(--clr-green)" }} />
        </div>
        <div>
          <h1 className="h2">Check your email</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We sent a password reset link to{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{sentEmail}</span>.
            It expires in 1 hour.
          </p>
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button
            onClick={() => setSent(false)}
            className="font-semibold hover:underline"
            style={{ color: "var(--navy)" }}
          >
            try again
          </button>.
        </p>
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-[13px] font-semibold hover:underline mt-1"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 anim-fade-up anim-d-150">
        <p className="eyebrow mb-1.5">Password reset</p>
        <h1 className="h1">Forgot password?</h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
          <AuthSubmitButton loading={loading} label="Send reset link" loadingLabel="Sending…" />
        </div>
      </form>

      <p className="mt-6 text-center anim-fade-in anim-d-350">
        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-[13px] font-semibold hover:underline"
          style={{ color: "var(--navy)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </>
  );
}
