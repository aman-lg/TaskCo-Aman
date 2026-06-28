"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera } from "lucide-react";
import { CountryCodeSelect } from "./country-code-select";

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

function splitPhone(phone: string | null): { code: string; local: string } {
  if (!phone) return { code: "+91", local: "" };
  // Match a country code prefix (+1 to +999)
  const match = phone.match(/^(\+\d{1,4})(\d*)$/);
  if (match) return { code: match[1], local: match[2] };
  return { code: "+91", local: phone };
}

export function ProfileClient({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [name, setName] = useState(profile.full_name ?? "");
  const [countryCode, setCountryCode] = useState(() => splitPhone(profile.phone).code);
  const [localPhone, setLocalPhone] = useState(() => splitPhone(profile.phone).local);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parts = splitPhone(profile.phone);
    setCountryCode(parts.code);
    setLocalPhone(parts.local);
  }, [profile.phone]);

  const phone = localPhone ? `${countryCode}${localPhone}` : null;

  async function handleSave() {
    if (!name.trim()) { setError("Name cannot be empty"); return; }
    if (localPhone && !/^\d{6,15}$/.test(localPhone)) {
      setError("Phone number must be 6–15 digits");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        full_name: name.trim(),
        phone: phone ?? null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Something went wrong");
    } else {
      setSuccess(true);
      router.refresh();
    }
  }

  const initials = getInitials(profile.full_name, profile.email);
  const isDirty =
    name.trim() !== (profile.full_name ?? "") ||
    phone !== (profile.phone ?? null);

  return (
    <div className="flex flex-col gap-5">

      {/* Avatar card */}
      <div className="rounded-2xl border p-6" style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}>
        <h2 className="text-[13px] font-bold uppercase tracking-wider mb-5" style={{ color: "var(--text-muted)" }}>Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[28px] font-bold"
                style={{ background: "var(--navy)", fontFamily: "var(--font-display)" }}
              >
                {initials}
              </div>
            )}
            <button
              type="button"
              disabled
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 flex items-center justify-center opacity-40 cursor-not-allowed"
              style={{ background: "var(--surface-bg)", borderColor: "var(--line)", color: "var(--text-muted)" }}
              title="Photo upload coming soon"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{profile.full_name ?? "No name set"}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{profile.email}</p>
            <p className="text-[11px] mt-2 px-2 py-0.5 rounded inline-block" style={{ background: "var(--line-soft)", color: "var(--text-fine)" }}>
              Photo upload coming in a future update
            </p>
          </div>
        </div>
      </div>

      {/* Personal info card */}
      <div className="rounded-2xl border p-6 flex flex-col gap-5" style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}>
        <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Personal Information</h2>

        <div className="grid gap-4">
          {/* Full name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setSuccess(false); setError(null); }}
              placeholder="Your full name"
              className="h-10 px-3 rounded-lg border text-[13px] outline-none transition-colors"
              style={{ borderColor: "var(--line)", background: "var(--panel-bg)", color: "var(--ink)" }}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")}
            />
          </div>

          {/* Email — read only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Email Address</label>
            <div
              className="h-10 px-3 rounded-lg border flex items-center text-[13px]"
              style={{ borderColor: "var(--line-soft)", background: "var(--line-soft)", color: "var(--text-muted)" }}
            >
              {profile.email?.toLowerCase() ?? "—"}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-fine)" }}>Email cannot be changed here.</p>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
            <div className="flex">
              <CountryCodeSelect
                value={countryCode}
                onChange={code => { setCountryCode(code); setSuccess(false); setError(null); }}
              />
              <input
                type="tel"
                value={localPhone}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "");
                  setLocalPhone(v);
                  setSuccess(false);
                  setError(null);
                }}
                placeholder="Phone number"
                maxLength={15}
                className="flex-1 h-10 px-3 border text-[13px] outline-none transition-colors"
                style={{
                  borderColor: "var(--line)",
                  background: "var(--panel-bg)",
                  color: "var(--ink)",
                  borderRadius: "0 8px 8px 0",
                  borderLeft: "none",
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = "var(--navy)";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = "var(--line)";
                }}
              />
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-fine)" }}>Digits only. Used for contact purposes only.</p>
          </div>
        </div>

        {error && (
          <p className="text-[13px] font-medium px-3 py-2 rounded-lg" style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
            {error}
          </p>
        )}
        {success && (
          <p className="text-[13px] font-medium px-3 py-2 rounded-lg" style={{ background: "color-mix(in srgb, var(--clr-green) 12%, transparent)", color: "var(--clr-green)" }}>
            Profile updated successfully.
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center gap-2 transition-opacity disabled:opacity-40"
            style={{ background: "var(--navy)" }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Account info card */}
      <div className="rounded-2xl border p-6 flex flex-col gap-3" style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}>
        <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Account</h2>
        <div style={{ borderBottom: "1px solid var(--line)" }} className="pb-3">
          <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>Member since</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="pt-1">
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>User ID</p>
          <p className="text-[11px] mt-0.5 font-mono break-all" style={{ color: "var(--text-muted)" }}>{profile.id}</p>
        </div>
      </div>
    </div>
  );
}
