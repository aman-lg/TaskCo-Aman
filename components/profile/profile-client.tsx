"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Camera, Pencil, X } from "lucide-react";
import { CountryCodeSelect } from "./country-code-select";

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  created_at?: string | null;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (email?.[0] ?? "U").toUpperCase();
}

function splitPhone(phone: string | null): { code: string; local: string } {
  if (!phone) return { code: "+91", local: "" };
  const match = phone.match(/^(\+\d{1,4})(\d*)$/);
  if (match) return { code: match[1], local: match[2] };
  return { code: "+91", local: phone };
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
      <span className="text-[12px] font-semibold sm:w-28 flex-shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[14px]" style={{ color: value ? "var(--ink)" : "var(--text-fine)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function ProfileClient({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.full_name ?? "");
  const [countryCode, setCountryCode] = useState(() => splitPhone(profile.phone).code);
  const [localPhone, setLocalPhone] = useState(() => splitPhone(profile.phone).local);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when profile prop changes (after refresh)
  useEffect(() => {
    if (!editing) {
      setName(profile.full_name ?? "");
      const parts = splitPhone(profile.phone);
      setCountryCode(parts.code);
      setLocalPhone(parts.local);
    }
  }, [profile, editing]);

  function handleCancel() {
    setName(profile.full_name ?? "");
    const parts = splitPhone(profile.phone);
    setCountryCode(parts.code);
    setLocalPhone(parts.local);
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name cannot be empty"); return; }
    if (localPhone && !/^\d{6,15}$/.test(localPhone)) {
      setError("Phone number must be 6–15 digits");
      return;
    }
    setSaving(true);
    setError(null);

    const phone = localPhone ? `${countryCode}${localPhone}` : null;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ full_name: name.trim(), phone }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Something went wrong");
    } else {
      setEditing(false);
      router.refresh();
    }
  }

  const initials = getInitials(profile.full_name, profile.email);
  const displayPhone = profile.phone
    ? `${splitPhone(profile.phone).code} ${splitPhone(profile.phone).local}`
    : null;

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── Avatar + identity ── */}
      <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover" />
            ) : (
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: "var(--navy)", fontFamily: "var(--font-display)", fontSize: "clamp(18px, 4vw, 28px)" }}
              >
                {initials}
              </div>
            )}
            <button
              type="button"
              disabled
              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center opacity-40 cursor-not-allowed"
              style={{ background: "var(--surface-bg)", borderColor: "var(--line)", color: "var(--text-muted)" }}
              title="Photo upload coming soon"
            >
              <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] sm:text-[16px] font-bold truncate" style={{ color: "var(--ink)" }}>
              {profile.full_name ?? "No name set"}
            </p>
            <p className="text-[12px] sm:text-[13px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
              {profile.email?.toLowerCase() ?? "—"}
            </p>
          </div>

          {/* Edit button */}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] sm:text-[13px] font-semibold border flex-shrink-0 transition-opacity hover:opacity-70"
              style={{ borderColor: "var(--line)", color: "var(--text-secondary)", background: "transparent" }}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* ── View mode ── */}
      {!editing && (
        <div className="rounded-2xl px-5 sm:px-6 py-2" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
          <div className="pt-3 pb-1">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Personal Information</p>
          </div>
          <Field label="Full Name" value={profile.full_name} />
          <Field label="Email" value={profile.email?.toLowerCase() ?? null} />
          <Field label="Phone" value={displayPhone} />
        </div>
      )}

      {/* ── Edit mode ── */}
      {editing && (
        <div className="rounded-2xl p-5 sm:p-6 flex flex-col gap-5" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Edit Profile</p>
            <button onClick={handleCancel} className="p-1 rounded-lg hover:opacity-70" style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(null); }}
                placeholder="Your full name"
                className="h-10 px-3 rounded-lg border text-[13px] outline-none transition-colors w-full"
                style={{ borderColor: "var(--line)", background: "var(--panel-bg)", color: "var(--ink)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--navy)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")}
              />
            </div>

            {/* Email — read only */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Email Address</label>
              <div
                className="h-10 px-3 rounded-lg border flex items-center text-[13px] w-full"
                style={{ borderColor: "var(--line-soft)", background: "var(--line-soft)", color: "var(--text-muted)" }}
              >
                {profile.email?.toLowerCase() ?? "—"}
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-fine)" }}>Email cannot be changed here.</p>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
              <div className="flex w-full">
                <CountryCodeSelect
                  value={countryCode}
                  onChange={code => { setCountryCode(code); setError(null); }}
                />
                <input
                  type="tel"
                  value={localPhone}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, "");
                    setLocalPhone(v);
                    setError(null);
                  }}
                  placeholder="Phone number"
                  maxLength={15}
                  className="flex-1 min-w-0 h-10 px-3 border text-[13px] outline-none transition-colors"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--panel-bg)",
                    color: "var(--ink)",
                    borderRadius: "0 8px 8px 0",
                    borderLeft: "none",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--navy)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--line)")}
                />
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-fine)" }}>Digits only, 6–15 characters.</p>
            </div>
          </div>

          {error && (
            <p className="text-[13px] font-medium px-3 py-2 rounded-lg" style={{ background: "var(--clr-red-bg)", color: "var(--clr-red)" }}>
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 justify-end flex-wrap">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold border disabled:opacity-40"
              style={{ borderColor: "var(--line)", color: "var(--text-secondary)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center gap-2 disabled:opacity-40"
              style={{ background: "var(--navy)" }}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {/* ── Account card ── */}
      <div className="rounded-2xl px-5 sm:px-6 py-4 flex flex-col gap-3" style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Account</p>
        {memberSince && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 pb-3 border-b" style={{ borderColor: "var(--line)" }}>
            <span className="text-[12px] font-semibold sm:w-28 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Member since</span>
            <span className="text-[14px]" style={{ color: "var(--ink)" }}>{memberSince}</span>
          </div>
        )}
        <div>
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)" }}>User ID</p>
          <p className="text-[11px] mt-0.5 font-mono break-all" style={{ color: "var(--text-muted)" }}>{profile.id}</p>
        </div>
      </div>
    </div>
  );
}
