"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("already registered")) {
          toast.error("An account with this email already exists.");
        } else {
          toast.error("Something went wrong. Please try again.");
        }
        return;
      }

      router.push("/verify-email?email=" + encodeURIComponent(values.email));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-7 anim-fade-up anim-d-150">
        <p className="eyebrow mb-1.5">Get started</p>
        <h1 className="h1">Create account</h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Join your team&apos;s workspace. A verification email will be sent.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="anim-fade-up anim-d-200">
          <AuthFormField
            id="fullName"
            label="Full name"
            type="text"
            autoComplete="name"
            placeholder="Aman Kumar"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
        </div>
        <div className="anim-fade-up anim-d-250">
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
        <div className="anim-fade-up anim-d-300">
          <AuthFormField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            hint="Min. 8 characters, one uppercase letter, one number."
            error={errors.password?.message}
            {...register("password")}
          />
        </div>
        <div className="anim-fade-up anim-d-350">
          <AuthFormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>

        <div className="anim-fade-up anim-d-400">
          <AuthSubmitButton loading={loading} label="Create account" loadingLabel="Creating account…" />
        </div>
      </form>

      <p className="mt-6 text-center text-[13px] anim-fade-in anim-d-500" style={{ color: "var(--text-secondary)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
