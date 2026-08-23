"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Loader2, CheckCircle2, Video, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slot {
  startISO: string;
  endISO: string;
}

interface Props {
  slug: string;
  hostName: string;
}

function dateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function BookingClient({ slug, hostName }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/booking/${slug}/availability`, { credentials: "same-origin" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json?.error?.message ?? "This booking page isn't available right now.");
          return;
        }
        setSlots(json.data.slots ?? []);
      } catch (err) {
        if (!cancelled) {
          console.error("[booking] availability load failed", err);
          setLoadError("Couldn't load availability. Please try again.");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const dayGroups = useMemo(() => {
    if (!slots) return [];
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKey(s.startISO);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).map(([date, daySlots]) => ({ date, slots: daySlots }));
  }, [slots]);

  // Derived, not stored: defaults to the first day with availability until the
  // visitor explicitly picks one, without needing an effect to sync state.
  const effectiveDate = selectedDate ?? dayGroups[0]?.date ?? null;
  const activeDaySlots = dayGroups.find((g) => g.date === effectiveDate)?.slots ?? [];

  function addParticipant() {
    setParticipantEmails((prev) => [...prev, ""]);
  }

  function updateParticipant(index: number, value: string) {
    setParticipantEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  }

  function removeParticipant(index: number) {
    setParticipantEmails((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!selectedSlot) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    const cleanedParticipants = participantEmails.map((e) => e.trim()).filter(Boolean);
    const invalidParticipant = cleanedParticipants.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalidParticipant) {
      toast.error(`"${invalidParticipant}" doesn't look like a valid email.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          requester_name: name.trim(),
          requester_email: email.trim(),
          participant_emails: cleanedParticipants.length > 0 ? cleanedParticipants : undefined,
          note: note.trim() || undefined,
          start_at: selectedSlot.startISO,
          end_at: selectedSlot.endISO,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to submit request");
        if (res.status === 400 && json?.error?.message?.includes("no longer available")) {
          setSelectedSlot(null);
          setSlots((prev) => prev?.filter((s) => s.startISO !== selectedSlot.startISO) ?? prev);
        }
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <CenteredCard>
        <CheckCircle2 className="h-10 w-10" style={{ color: "var(--clr-green)" }} />
        <h1 className="text-[19px] font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Request sent
        </h1>
        <p className="text-[13px] max-w-sm" style={{ color: "var(--text-muted)" }}>
          {hostName} will confirm your call for{" "}
          {selectedSlot && new Date(selectedSlot.startISO).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
          })}. You&apos;ll get an email with the Google Meet link once they do.
        </p>
      </CenteredCard>
    );
  }

  if (loadError) {
    return (
      <CenteredCard>
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{loadError}</p>
      </CenteredCard>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
      <div
        className="w-full max-w-[720px] rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: "var(--surface-bg)", boxShadow: "0 4px 32px rgba(0,0,0,0.12)" }}
      >
        {/* Left: host info */}
        <div className="md:w-[220px] flex-shrink-0 p-6 flex flex-col gap-3" style={{ background: "var(--navy)", color: "#fff" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[16px] font-bold" style={{ fontFamily: "var(--font-display)" }}>{hostName}</p>
            <p className="text-[12px] opacity-70 mt-1">30 minute call</p>
          </div>
          {selectedSlot && (
            <div className="mt-2 pt-3 text-[12px] opacity-80" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
              {new Date(selectedSlot.startISO).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short",
              })}
              <br />
              {new Date(selectedSlot.startISO).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>

        {/* Right: picker / form */}
        {/* min-w-0 is load-bearing: without it, the day-picker's overflow-x-auto
            row (8 day buttons) forces this flex item to grow past the card's
            width instead of scrolling internally, clipping the 3rd grid column
            behind the card's overflow-hidden. */}
        <div className="flex-1 min-w-0 p-6">
          {slots === null ? (
            <div className="flex items-center gap-2 py-10 justify-center" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading availability…
            </div>
          ) : slots.length === 0 ? (
            <p className="text-[13px] py-10 text-center" style={{ color: "var(--text-muted)" }}>
              No open slots in the next two weeks — please check back later.
            </p>
          ) : !selectedSlot ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                <Calendar className="h-4 w-4" /> Pick a day
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {dayGroups.map((g) => (
                  <button
                    key={g.date}
                    onClick={() => setSelectedDate(g.date)}
                    className="flex-shrink-0 h-14 w-14 rounded-xl flex flex-col items-center justify-center text-[12px] font-semibold transition-colors"
                    style={{
                      background: effectiveDate === g.date ? "var(--navy)" : "var(--panel-bg)",
                      color: effectiveDate === g.date ? "#fff" : "var(--ink)",
                    }}
                  >
                    <span className="text-[10px] opacity-70">
                      {new Date(`${g.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                    {g.date.slice(8, 10)}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  <Clock className="h-4 w-4" /> Pick a time (IST)
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {activeDaySlots.length} time{activeDaySlots.length !== 1 ? "s" : ""} available
                </span>
              </div>
              {activeDaySlots.length === 0 ? (
                <p className="text-[12px] py-4 text-center" style={{ color: "var(--text-muted)" }}>
                  No open times on this day — try another day above.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {activeDaySlots.map((s) => (
                    <button
                      key={s.startISO}
                      onClick={() => setSelectedSlot(s)}
                      className="h-9 rounded-lg text-[12px] font-semibold transition-colors"
                      style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
                    >
                      {new Date(s.startISO).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setSelectedSlot(null)}
                className="self-start text-[12px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--navy)" }}
              >
                ← Choose a different time
              </button>

              <div className="float-label-wrap">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  className="float-label-input"
                />
                <label className="float-label">Your name *</label>
              </div>
              <div className="float-label-wrap">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  className="float-label-input"
                />
                <label className="float-label">Email *</label>
              </div>

              {participantEmails.length > 0 && (
                <div className="flex flex-col gap-2">
                  {participantEmails.map((pEmail, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={pEmail}
                        onChange={(e) => updateParticipant(idx, e.target.value)}
                        placeholder="participant@email.com"
                        className="flex-1 h-10 px-3 rounded-lg text-[13px]"
                        style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeParticipant(idx)}
                        className="p-2 rounded-lg transition-colors hover:bg-[var(--line-soft)]"
                        style={{ color: "var(--text-muted)" }}
                        aria-label="Remove participant"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addParticipant}
                className="self-start flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "var(--navy)" }}
              >
                <Plus className="h-3.5 w-3.5" /> Add another participant
              </button>

              <div className="float-label-wrap">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder=" "
                  className="float-label-textarea"
                />
                <label className="float-label">What&apos;s this about? (optional)</label>
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className={cn(
                  "h-10 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                )}
                style={{ background: "var(--navy)" }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Request this time
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
      <div
        className="w-full max-w-[420px] rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surface-bg)", boxShadow: "0 4px 32px rgba(0,0,0,0.12)" }}
      >
        {children}
      </div>
    </div>
  );
}
