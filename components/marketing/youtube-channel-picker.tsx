"use client";

import { useState } from "react";
import { ListVideo, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface ChannelCandidate {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
}

// Lets an admin see every channel the connected Google login can actually
// see (via channels.list?mine=true) and repoint the connection at a
// different one — the "mapping" tool for when the wrong channel got
// connected (e.g. a personal channel instead of the intended content
// channel). If only one channel ever shows up here, that's not fixable from
// this picker — it means the token genuinely can't see any other channel,
// which is a Google-account-permissions question.
export function YoutubeChannelPicker({ onSwitched }: { onSwitched: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ChannelCandidate[] | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    const res = await fetch("/api/marketing/youtube/channels", { credentials: "same-origin" });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { toast.error(json?.error?.message ?? "Couldn't load channels"); setOpen(false); return; }
    setChannels(json.data.channels);
    setConnectedId(json.data.connectedChannelId);
  }

  async function selectChannel(channelId: string) {
    setSwitching(channelId);
    const res = await fetch("/api/marketing/youtube/channels/select", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: channelId }),
    });
    const json = await res.json().catch(() => ({}));
    setSwitching(null);
    if (!res.ok) { toast.error(json?.error?.message ?? "Couldn't switch channel"); return; }
    toast.success(`Now connected to "${json.data.channelTitle}"`);
    setConnectedId(channelId);
    setOpen(false);
    onSwitched();
  }

  return (
    <div className="relative">
      <button
        onClick={() => void toggle()}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold"
        style={{ color: "var(--navy)", border: "1px solid var(--line)" }}
      >
        <ListVideo className="w-4 h-4" /> Channels
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl p-2 z-10"
          style={{ background: "var(--surface-bg)", border: "1px solid var(--line)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
        >
          {loading ? (
            <p className="text-[12.5px] py-3 text-center" style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : !channels || channels.length === 0 ? (
            <p className="text-[12.5px] py-3 text-center" style={{ color: "var(--text-fine)" }}>No channels visible to this connection.</p>
          ) : (
            <>
              {channels.length === 1 && (
                <p className="text-[11.5px] px-2 pb-2" style={{ color: "var(--text-muted)" }}>
                  Only one channel is visible to this Google login — if this isn&apos;t your content channel, it needs proper Brand Account access, not a different pick here.
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {channels.map((c) => (
                  <li key={c.channelId}>
                    <button
                      onClick={() => void selectChannel(c.channelId)}
                      disabled={switching !== null || c.channelId === connectedId}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left disabled:opacity-60"
                      style={{ background: c.channelId === connectedId ? "var(--navy-l)" : "transparent" }}
                    >
                      {c.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.thumbnailUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: "var(--line)" }} />
                      )}
                      <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{c.title}</span>
                      {switching === c.channelId ? (
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      ) : c.channelId === connectedId ? (
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--navy)" }} />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
