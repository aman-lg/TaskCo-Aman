"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Video, Copy, Check, ExternalLink, Loader2, Unlink } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Booking {
  id: string;
  requester_name: string;
  requester_email: string;
  note: string | null;
  start_at: string;
  end_at: string;
  status: "pending" | "confirmed" | "declined" | "cancelled";
  meet_link: string | null;
}

interface Status {
  connected: boolean;
  googleEmail: string | null;
  bookingSlug: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state_mismatch: "Google sign-in failed a security check — please try connecting again.",
  no_refresh_token: "Google didn't grant offline access. Try disconnecting any prior TaskCo access in your Google account settings, then reconnect.",
  save_failed: "Connected, but saving the connection failed. Please try again.",
  connect_failed: "Couldn't connect to Google Calendar. Please try again.",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MeetingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Booking | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, bookingsRes] = await Promise.all([
        fetch("/api/meetings/status", { credentials: "same-origin" }),
        fetch("/api/bookings", { credentials: "same-origin" }),
      ]);
      if (statusRes.ok) setStatus((await statusRes.json()).data);
      if (bookingsRes.ok) setBookings((await bookingsRes.json()).data ?? []);
      setNow(Date.now());
    } catch (err) {
      console.error("[meetings] load failed", err);
      toast.error("Couldn't load meetings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Surface the OAuth callback's outcome once, then scrub the query string.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) toast.success("Google Calendar connected.");
    if (error) toast.error(ERROR_MESSAGES[error] ?? "Something went wrong connecting Google Calendar.");
    if (connected || error) router.replace("/meetings");
  }, [searchParams, router]);

  async function copyLink() {
    if (!status?.bookingSlug) return;
    const url = `${window.location.origin}/book/${status.bookingSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST", credentials: "same-origin" });
      if (!res.ok) { toast.error("Failed to disconnect."); return; }
      toast.success("Google Calendar disconnected.");
      await load();
    } finally {
      setDisconnecting(false);
    }
  }

  async function confirmBooking(id: string) {
    setActioningId(id);
    try {
      const res = await fetch(`/api/bookings/${id}/confirm`, { method: "POST", credentials: "same-origin" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to confirm booking");
        return;
      }
      toast.success("Booking confirmed — Meet link sent.");
      await load();
    } finally {
      setActioningId(null);
    }
  }

  async function declineBooking() {
    if (!declineTarget) return;
    setActioningId(declineTarget.id);
    try {
      const res = await fetch(`/api/bookings/${declineTarget.id}/decline`, { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        toast.error("Failed to decline booking");
        return;
      }
      setDeclineTarget(null);
      await load();
    } finally {
      setActioningId(null);
    }
  }

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed" && new Date(b.end_at).getTime() > now);
  const past = bookings
    .filter((b) => b.status === "declined" || b.status === "cancelled" || (b.status === "confirmed" && new Date(b.end_at).getTime() <= now))
    .slice(0, 10);

  const bookingUrl = status?.bookingSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${status.bookingSlug}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1" style={{ color: "var(--ink)" }}>Meetings</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-muted)" }}>
          Let people book time on your calendar — you confirm before a Meet link goes out.
        </p>
      </div>

      {/* Connection card */}
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        {loading ? (
          <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : status?.connected ? (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--clr-green-bg)" }}>
                  <Video className="h-5 w-5" style={{ color: "var(--clr-green)" }} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Google Calendar connected</p>
                  {status.googleEmail && (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{status.googleEmail}</p>
                  )}
                </div>
              </div>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            </div>

            {bookingUrl && (
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="flex-1 min-w-[200px] h-9 px-3 rounded-lg text-[13px] flex items-center truncate"
                  style={{ background: "var(--panel-bg)", color: "var(--text-secondary)" }}
                >
                  {bookingUrl}
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold text-white transition-colors"
                  style={{ background: "var(--navy)" }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "var(--panel-bg)" }}>
              <Video className="h-6 w-6" style={{ color: "var(--text-muted)" }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>Connect Google Calendar</p>
              <p className="text-[12px] mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                Get a public booking link so people can request time on your calendar. You confirm each request before a Google Meet link is created.
              </p>
            </div>
            <a
              href="/api/auth/google/connect"
              className="h-9 px-5 rounded-lg text-[13px] font-bold text-white flex items-center transition-colors"
              style={{ background: "var(--navy)" }}
            >
              Connect Google Calendar
            </a>
          </div>
        )}
      </div>

      {status?.connected && (
        <>
          {/* Pending requests */}
          <section className="flex flex-col gap-3">
            <h2 className="h3" style={{ color: "var(--ink)" }}>
              Pending requests {pending.length > 0 && `(${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <EmptyRow message="No pending booking requests." />
            ) : (
              <div className="flex flex-col gap-2">
                {pending.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                        {b.requester_name} <span className="font-normal" style={{ color: "var(--text-muted)" }}>· {b.requester_email}</span>
                      </p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{formatWhen(b.start_at)}</p>
                      {b.note && <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{b.note}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setDeclineTarget(b)}
                        disabled={actioningId === b.id}
                        className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
                        style={{ border: "1px solid var(--line)", color: "var(--text-secondary)" }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => confirmBooking(b.id)}
                        disabled={actioningId === b.id}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold text-white transition-colors disabled:opacity-50"
                        style={{ background: "var(--navy)" }}
                      >
                        {actioningId === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Confirm
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming confirmed */}
          <section className="flex flex-col gap-3">
            <h2 className="h3" style={{ color: "var(--ink)" }}>Upcoming</h2>
            {confirmed.length === 0 ? (
              <EmptyRow message="No upcoming meetings." />
            ) : (
              <div className="flex flex-col gap-2">
                {confirmed.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
                    style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{b.requester_name}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{formatWhen(b.start_at)}</p>
                    </div>
                    {b.meet_link && (
                      <a
                        href={b.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold text-white transition-colors flex-shrink-0"
                        style={{ background: "var(--clr-green)" }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Join
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="h3" style={{ color: "var(--ink)" }}>History</h2>
              <div className="flex flex-col gap-2">
                {past.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl p-3.5 flex items-center justify-between gap-3"
                    style={{ background: "var(--panel-bg)" }}
                  >
                    <p className="text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>{b.requester_name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{formatWhen(b.start_at)}</p>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                        style={{
                          background: b.status === "declined" ? "var(--clr-red-bg)" : "var(--line)",
                          color: b.status === "declined" ? "var(--clr-red)" : "var(--text-muted)",
                        }}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!declineTarget}
        onOpenChange={(v) => !v && setDeclineTarget(null)}
        title={`Decline ${declineTarget?.requester_name}'s request?`}
        description="They won't be notified automatically — you may want to follow up by email."
        confirmLabel="Decline"
        destructive
        loading={!!actioningId}
        onConfirm={declineBooking}
      />
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-6 text-center text-[13px]"
      style={{ background: "var(--panel-bg)", color: "var(--text-muted)" }}
    >
      {message}
    </div>
  );
}
