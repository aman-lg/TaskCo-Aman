"use client";

import { SquarePlay } from "lucide-react";

// lucide-react dropped literal brand/logo icons a while back — plain letter
// badges for the "coming soon" row instead of chasing generic look-alikes
// per platform, which would only get more fragile as the icon set evolves.
const OTHER_PLATFORMS = [
  { name: "Instagram", short: "IG" },
  { name: "Facebook", short: "FB" },
  { name: "LinkedIn", short: "in" },
  { name: "Twitter", short: "X" },
];

// Shown when no YouTube connection exists yet. The other platforms render
// as visibly-disabled chips — communicates the roadmap (YouTube first, the
// rest later) without pretending they're already wired up.
export function YoutubeConnectCard() {
  return (
    <div className="rounded-xl p-8 flex flex-col items-center text-center gap-4" style={{ background: "var(--surface-bg)", border: "1px solid var(--line)" }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--clr-red-bg)" }}>
        <SquarePlay className="w-7 h-7" style={{ color: "#DC2626" }} />
      </div>
      <div>
        <p className="text-[16px] font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Connect YouTube</p>
        <p className="mt-1.5 text-[13px] max-w-sm" style={{ color: "var(--text-muted)" }}>
          Pull in every video's views, likes, comments, shares, and impressions, then let Tasko tell you
          what's working and when to post.
        </p>
      </div>
      <a
        href="/api/auth/youtube/connect"
        className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-[13.5px] font-semibold text-white"
        style={{ background: "var(--navy)" }}
      >
        <SquarePlay className="w-4 h-4" /> Connect YouTube
      </a>

      <div className="flex items-center gap-3 mt-2 pt-4 w-full justify-center" style={{ borderTop: "1px solid var(--line-soft)" }}>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-fine)" }}>Coming soon</span>
        {OTHER_PLATFORMS.map((p) => (
          <span
            key={p.name}
            title={`${p.name} — coming soon`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold"
            style={{ background: "var(--line-soft)", color: "var(--text-fine)" }}
          >
            {p.short}
          </span>
        ))}
      </div>
    </div>
  );
}
