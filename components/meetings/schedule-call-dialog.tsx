"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDate?: string | null; // YYYY-MM-DD, IST
  onScheduled: () => void;
}

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ScheduleCallDialog({ open, onClose, defaultDate, onScheduled }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate ?? todayIST());
    setName("");
    setEmail("");
    setParticipants([]);
    setTime("10:00");
    setDuration(30);
    setNote("");
  }, [open, defaultDate]);

  function addParticipant() {
    setParticipants((prev) => [...prev, ""]);
  }
  function updateParticipant(index: number, value: string) {
    setParticipants((prev) => prev.map((e, i) => (i === index ? value : e)));
  }
  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (!name.trim() || !email.trim() || !date || !time) {
      toast.error("Fill in the participant's name, email, date, and time.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("That email address doesn't look valid.");
      return;
    }
    const cleaned = participants.map((p) => p.trim()).filter(Boolean);
    const invalid = cleaned.find((e) => !EMAIL_RE.test(e));
    if (invalid) {
      toast.error(`"${invalid}" doesn't look like a valid email.`);
      return;
    }

    const start = new Date(`${date}T${time}:00+05:30`); // IST wall-clock time
    if (Number.isNaN(start.getTime())) {
      toast.error("Pick a valid date and time.");
      return;
    }
    const end = new Date(start.getTime() + duration * 60_000);

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          requester_name: name.trim(),
          requester_email: email.trim(),
          participant_emails: cleaned.length > 0 ? cleaned : undefined,
          note: note.trim() || undefined,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Failed to schedule call");
        return;
      }
      toast.success("Call scheduled — invite sent.");
      onScheduled();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-[440px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-6 py-4 border-b border-[var(--line)]">
          <DialogTitle className="h3 text-[var(--ink)]">Schedule a call</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--line-soft)] flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="p-5 max-h-[65vh] overflow-y-auto flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="float-label-wrap">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="float-label-input" />
              <label className="float-label">Date</label>
            </div>
            <div className="float-label-wrap">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="float-label-input" />
              <label className="float-label">Time (IST)</label>
            </div>
          </div>

          <div className="select-wrap">
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="select-field">
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
            <span className="select-label">Duration</span>
            <ChevronDown className="select-arrow" />
          </div>

          <div className="float-label-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder=" " className="float-label-input" />
            <label className="float-label">Participant name *</label>
          </div>
          <div className="float-label-wrap">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder=" " className="float-label-input" />
            <label className="float-label">Participant email *</label>
          </div>

          {participants.length > 0 && (
            <div className="flex flex-col gap-2">
              {participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={p}
                    onChange={(e) => updateParticipant(idx, e.target.value)}
                    placeholder="another@email.com"
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
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder=" " className="float-label-textarea" />
            <label className="float-label">Note (optional)</label>
          </div>
        </div>

        <div className="px-5 py-4 flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--panel-bg)]">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-semibold border border-[var(--line)] text-[var(--text-secondary)] bg-transparent transition-colors hover:bg-[var(--line-soft)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-10 px-6 rounded-xl text-[13px] font-bold text-white flex items-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
