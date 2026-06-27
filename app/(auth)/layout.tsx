import Link from "next/link";
import { CheckSquare2, Clock3, Users2 } from "lucide-react";

const features = [
  { Icon: CheckSquare2, text: "Create and assign tasks with urgency levels" },
  { Icon: Clock3,       text: "Track working hours and task time separately" },
  { Icon: Users2,       text: "Stay aligned across projects and deadlines" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (navy branded) — hidden on mobile ── */}
      <aside
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative flex-col justify-between p-12 overflow-hidden flex-shrink-0"
        style={{ backgroundColor: "var(--navy)" }}
      >
        {/* Brand mark */}
        <Link
          href="/login"
          className="inline-block text-[22px] font-extrabold tracking-tight text-white"
        >
          Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
        </Link>

        {/* Main copy */}
        <div className="relative z-10">
          <p
            className="text-[13px] font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--accent-brand)" }}
          >
            Team Task Management
          </p>
          <h2
            className="text-[38px] leading-[1.15] font-normal text-white mb-5"
            style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
          >
            Your workspace,<br />beautifully<br />organised.
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-10"
            style={{ color: "rgba(255,255,255,0.58)" }}
          >
            Manage tasks, track time, and stay in sync with your team — all in one place.
          </p>

          <ul className="space-y-3.5">
            {features.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3.5">
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "var(--accent-brand)" }} />
                </span>
                <span
                  className="text-[13px] font-medium leading-snug"
                  style={{ color: "rgba(255,255,255,0.78)" }}
                >
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>
          © {new Date().getFullYear()} TaskCo · Internal tool · Not for public access
        </p>

        {/* Decorative rings — bottom-right */}
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[320px] h-[320px] rounded-full"
          style={{
            border: "56px solid rgba(206,126,55,0.13)",
            transform: "translate(38%, 38%)",
          }}
        />
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full"
          style={{
            border: "40px solid rgba(206,126,55,0.09)",
            transform: "translate(28%, 28%)",
          }}
        />
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[100px] h-[100px] rounded-full"
          style={{
            backgroundColor: "rgba(206,126,55,0.16)",
            transform: "translate(18%, 18%)",
          }}
        />

        {/* Subtle top-right accent dot */}
        <span
          className="pointer-events-none absolute top-10 right-10 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "var(--accent-brand)", opacity: 0.6 }}
        />
        <span
          className="pointer-events-none absolute top-16 right-16 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "var(--accent-brand)", opacity: 0.35 }}
        />
      </aside>

      {/* ── Right panel (form) ── */}
      <main
        className="flex-1 flex flex-col min-h-screen"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        {/* Mobile-only brand strip */}
        <div className="lg:hidden flex items-center justify-center pt-8 pb-1">
          <Link
            href="/login"
            className="text-[22px] font-extrabold tracking-tight"
            style={{ color: "var(--navy)" }}
          >
            Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
          </Link>
        </div>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-[420px]">
            {/* Card */}
            <div
              className="rounded-2xl p-8"
              style={{
                backgroundColor: "var(--surface-bg)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-elev)",
              }}
            >
              {children}
            </div>

            {/* Below-card footnote */}
            <p
              className="mt-5 text-center text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Internal tool · Not for public access
            </p>
          </div>
        </div>
      </main>

    </div>
  );
}
