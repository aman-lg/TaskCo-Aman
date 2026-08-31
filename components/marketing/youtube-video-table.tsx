"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface YoutubeVideoRow {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  published_at: string;
  duration_seconds: number | null;
  category_name: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  impressions_ctr: number | null;
}

type SortKey = "published_at" | "views" | "likes" | "comments" | "shares" | "impressions" | "impressions_ctr";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "published_at", label: "Published" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "impressions", label: "Impressions" },
  { key: "impressions_ctr", label: "CTR" },
];

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function YoutubeVideoTable({ videos }: { videos: YoutubeVideoRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...videos];
    copy.sort((a, b) => {
      const av = sortKey === "published_at" ? new Date(a.published_at).getTime() : (a[sortKey] ?? -1);
      const bv = sortKey === "published_at" ? new Date(b.published_at).getTime() : (b[sortKey] ?? -1);
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [videos, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: "var(--surface-bg)", border: "1px solid var(--line)" }}>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No videos synced yet — click Sync Now above.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-x-auto" style={{ background: "var(--surface-bg)", border: "1px solid var(--line)" }}>
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Video</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">
                <button
                  onClick={() => toggleSort(c.key)}
                  className="flex items-center gap-1 hover:opacity-70"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.video_id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
              <td className="px-4 py-3">
                <a
                  href={`https://youtube.com/watch?v=${v.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-w-[240px] max-w-[360px] hover:opacity-80"
                >
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt="" className="w-16 h-9 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-9 rounded flex-shrink-0" style={{ background: "var(--line-soft)" }} />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{v.title}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-fine)" }}>
                      {v.category_name ?? ""}{v.category_name && v.duration_seconds != null ? " · " : ""}{fmtDuration(v.duration_seconds)}
                    </p>
                  </div>
                </a>
              </td>
              <td className="px-3 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {new Date(v.published_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="px-3 py-3 text-[13px] font-medium" style={{ color: "var(--ink)" }}>{fmtNum(v.views)}</td>
              <td className="px-3 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>{fmtNum(v.likes)}</td>
              <td className="px-3 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>{fmtNum(v.comments)}</td>
              <td className="px-3 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>{fmtNum(v.shares)}</td>
              <td className="px-3 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>{fmtNum(v.impressions)}</td>
              <td className="px-3 py-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {v.impressions_ctr != null ? `${(v.impressions_ctr * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
