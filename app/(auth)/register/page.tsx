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
import { CountryCodeSelect } from "@/components/profile/country-code-select";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [localPhone, setLocalPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    if (localPhone && !/^\d{6,15}$/.test(localPhone)) {
      setPhoneError("Phone must be 6–15 digits");
      return;
    }
    setPhoneError(null);
    setLoading(true);

    const phone = localPhone ? `${countryCode}${localPhone}` : undefined;

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName, phone },
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

        {/* Phone — optional */}
        <div className="flex flex-col gap-1.5 anim-fade-up anim-d-275">
          <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Phone number{" "}
            <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <div className="flex">
            <CountryCodeSelect
              value={countryCode}
              onChange={code => { setCountryCode(code); setPhoneError(null); }}
            />
            <input
              type="tel"
              value={localPhone}
              onChange={e => {
                setLocalPhone(e.target.value.replace(/\D/g, ""));
                setPhoneError(null);
              }}
              placeholder="Phone number"
              maxLength={15}
              autoComplete="tel"
              className="flex-1 min-w-0 h-10 px-3 border text-[13px] outline-none transition-colors"
              style={{
                borderColor: phoneError ? "var(--clr-red)" : "var(--line)",
                background: "var(--panel-bg)",
                color: "var(--ink)",
                borderRadius: "0 8px 8px 0",
                borderLeft: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={e => (e.currentTarget.style.borderColor = phoneError ? "var(--clr-red)" : "var(--line)")}
            />
          </div>
          {phoneError && (
            <p className="text-[11px] font-medium" style={{ color: "var(--clr-red)" }}>{phoneError}</p>
          )}
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
