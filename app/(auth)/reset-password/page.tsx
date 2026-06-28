"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });

      if (error) {
        toast.error("Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-5 anim-scale-in">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: "var(--clr-green-bg)" }}
        >
          <CheckCircle className="h-7 w-7" style={{ color: "var(--clr-green)" }} />
        </div>
        <div>
          <h1 className="h2">Password updated</h1>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Your password has been changed. Redirecting you to the dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 anim-fade-up anim-d-150">
        <p className="eyebrow mb-1.5">New password</p>
        <h1 className="h1">Reset password</h1>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Choose a strong new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="anim-fade-up anim-d-200">
          <AuthFormField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            hint="Min. 8 characters, one uppercase letter, one number."
            error={errors.password?.message}
            {...register("password")}
          />
        </div>
        <div className="anim-fade-up anim-d-250">
          <AuthFormField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </div>
        <div className="anim-fade-up anim-d-300">
          <AuthSubmitButton loading={loading} label="Update password" loadingLabel="Updating…" />
        </div>
      </form>
    </>
  );
}
