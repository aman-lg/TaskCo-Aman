import { Video } from "lucide-react";

export default function MeetingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1" style={{ color: "var(--ink)" }}>Meetings</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--text-muted)" }}>
          Video calls and scheduled meetings
        </p>
      </div>

      <div
        className="rounded-xl p-10 flex flex-col items-center gap-4 text-center"
        style={{ background: "var(--surface-bg)", boxShadow: "0 1px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--panel-bg)" }}
        >
          <Video className="h-8 w-8" style={{ color: "var(--text-muted)" }} />
        </div>
        <div>
          <p className="text-[17px] font-bold" style={{ color: "var(--ink)" }}>
            Google Meet integration coming soon
          </p>
          <p className="text-[13px] mt-2 max-w-md" style={{ color: "var(--text-muted)" }}>
            Connect your Google account to see upcoming meetings, join calls directly, and link meetings to your tasks and projects.
          </p>
        </div>
        <button
          disabled
          className="h-9 px-5 rounded-lg text-[13px] font-semibold border opacity-50 cursor-not-allowed"
          style={{ borderColor: "var(--line)", color: "var(--text-secondary)" }}
        >
          Connect Google Meet
        </button>
      </div>
    </div>
  );
}
