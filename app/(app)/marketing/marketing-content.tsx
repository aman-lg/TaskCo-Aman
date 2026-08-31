"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { SocialMediaPanel } from "@/components/marketing/social-media-panel";

// Only one tab today (Social Media) — a plain in-page tab strip rather than
// new sidebar-nesting infrastructure, so adding Email/Ads/etc. later is just
// another entry in this array, not a new nav pattern.
const TABS = [{ key: "social", label: "Social Media", icon: Share2 }] as const;

export function MarketingContent() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("social");

  // Reads the one-time query param the OAuth callback redirects with
  // (?connected=1 / ?error=...) via plain window.location rather than
  // useSearchParams(), which would require wrapping this page in <Suspense>
  // for a single on-mount toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") toast.success("YouTube connected");
    const error = params.get("error");
    if (error) toast.error(`Connection failed (${error})`);
    if (params.has("connected") || params.has("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--panel-bg)", border: "1px solid var(--line-soft)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[13px] font-semibold transition-[background,color,box-shadow] duration-150"
            style={
              tab === t.key
                ? { background: "var(--surface-bg)", color: "var(--navy)", boxShadow: "var(--shadow-card)" }
                : { background: "transparent", color: "var(--text-muted)" }
            }
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "social" && <SocialMediaPanel />}
    </div>
  );
}
