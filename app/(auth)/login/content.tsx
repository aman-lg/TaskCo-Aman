"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _redirectTo = searchParams.get("redirectTo");
  const redirectTo = _redirectTo?.startsWith("/") && !_redirectTo.startsWith("//") ? _redirectTo : "/dashboard";
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Please verify your email before signing in.");
        } else if (error.message.toLowerCase().includes("invalid login")) {
          toast.error("Incorrect email or password.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
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

      <p className="mt-6 text-center text-[13px] anim-fade-in anim-d-400" style={{ color: "var(--text-secondary)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Create one
        </Link>
      </p>
    </>
  );
}
