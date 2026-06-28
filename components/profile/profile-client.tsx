"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera } from "lucide-react";

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

export function ProfileClient({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [name, setName] = useState(profile.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError("Name cannot be empty"); return; }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ full_name: name.trim() }),
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

  return (
    <div className="flex flex-col gap-6">

      {/* Avatar */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <h2 className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name ?? "Avatar"}
                className="w-20 h-20 rounded-full object-cover"
              />
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
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 flex items-center justify-center opacity-50 cursor-not-allowed"
              style={{ background: "var(--surface-bg)", borderColor: "var(--line)", color: "var(--text-muted)" }}
              title="Photo upload coming soon"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
              {profile.full_name ?? "No name set"}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {profile.email}
            </p>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
              Photo upload available in a future update.
            </p>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-5"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <h2 className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>Personal Information</h2>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSuccess(false); setError(null); }}
              placeholder="Your full name"
              className="h-10 px-3 rounded-lg border text-[13px] outline-none transition-colors"
              style={{
                borderColor: "var(--line)",
                background: "var(--panel-bg)",
                color: "var(--ink)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--navy)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
            />
          </div>

          {/* Email — read only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
              Email Address
            </label>
            <div
              className="h-10 px-3 rounded-lg border flex items-center text-[13px]"
              style={{ borderColor: "var(--line-soft)", background: "var(--line-soft)", color: "var(--text-muted)" }}
            >
              {profile.email ?? "—"}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Email is managed through your authentication provider and cannot be changed here.
            </p>
          </div>
        </div>

        {/* Feedback */}
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
            disabled={saving || name.trim() === (profile.full_name ?? "")}
            className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center gap-2 transition-colors disabled:opacity-40"
            style={{ background: "var(--navy)" }}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>

      {/* Account info */}
      <div
        className="rounded-xl border p-6 flex flex-col gap-3"
        style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}
      >
        <h2 className="text-[14px] font-bold" style={{ color: "var(--ink)" }}>Account</h2>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>User ID</p>
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>{profile.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
