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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
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
          toast.error(error.message);
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
      <div className="mb-6">
        <p className="eyebrow mb-1">Welcome back</p>
        <h1 className="h1" style={{ color: "var(--ink)" }}>Sign in</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Enter your credentials to access your workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <AuthFormField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <AuthFormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--navy)" }}
          >
            Forgot password?
          </Link>
        </div>

        <AuthSubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Create one
        </Link>
      </p>
    </>
  );
}
