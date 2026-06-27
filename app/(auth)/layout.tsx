import Link from "next/link";
import { CheckSquare2, Clock3, Users2 } from "lucide-react";

const features = [
  { Icon: CheckSquare2, text: "Create and assign tasks with urgency levels" },
  { Icon: Clock3,       text: "Track working hours and task time separately" },
  { Icon: Users2,       text: "Stay aligned across projects and deadlines" },
];

/**
 * Auth layout — split panel (design.md §5, §8 session/event pages).
 *
 * Left  — fixed navy branded panel: wordmark, serif italic headline, feature
 *         list, decorative concentric rings.
 * Right — bare form area (no card container). Inputs sit directly on --page-bg
 *         (#F6F7F9). White floating-label inputs provide natural contrast
 *         without a wrapper box (Notion-flat principle, design.md §4 shadow).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (navy branded) ── */}
      <aside
        className="hidden lg:flex lg:w-[44%] xl:w-[42%] relative flex-col justify-between p-12 overflow-hidden flex-shrink-0"
        style={{ backgroundColor: "var(--navy)" }}
      >
        {/* Brand mark */}
        <Link
          href="/login"
          className="inline-block text-[22px] font-bold tracking-tight text-white anim-fade-down"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
        </Link>

        {/* Copy block */}
        <div className="relative z-10">
          <p
            className="eyebrow mb-4 anim-fade-in anim-d-150"
            style={{ color: "var(--accent-brand)" }}
          >
            Team Task Management
          </p>
          <h2
            className="text-[38px] leading-[1.15] font-bold text-white mb-5 text-balance anim-fade-up anim-d-200"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            Your workspace,<br />beautifully<br />organised.
          </h2>
          <p
            className="text-[14px] leading-relaxed mb-10 anim-fade-up anim-d-250"
            style={{ color: "rgba(255,255,255,0.58)", textWrap: "pretty" } as React.CSSProperties}
          >
            Manage tasks, track time, and stay in sync with your team — all in one place.
          </p>

          <ul className="space-y-3.5">
            {features.map(({ Icon, text }, i) => (
              <li
                key={text}
                className="flex items-center gap-3.5 anim-slide-left"
                style={{ "--anim-delay": `${300 + i * 70}ms` } as React.CSSProperties}
              >
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
        <p
          className="relative z-10 text-[11px] anim-fade-in anim-d-500"
          style={{ color: "rgba(255,255,255,0.28)" }}
        >
          © {new Date().getFullYear()} TaskCo · Internal tool · Not for public access
        </p>

        {/* Decorative rings — bottom-right */}
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[320px] h-[320px] rounded-full"
          style={{ border: "56px solid rgba(161,194,189,0.12)", transform: "translate(38%, 38%)" }}
        />
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full"
          style={{ border: "40px solid rgba(161,194,189,0.08)", transform: "translate(28%, 28%)" }}
        />
        <span
          className="pointer-events-none absolute bottom-0 right-0 w-[100px] h-[100px] rounded-full"
          style={{ backgroundColor: "rgba(161,194,189,0.15)", transform: "translate(18%, 18%)" }}
        />
        <span className="pointer-events-none absolute top-10 right-10 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "var(--accent-brand)", opacity: 0.6 }} />
        <span className="pointer-events-none absolute top-16 right-16 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "var(--accent-brand)", opacity: 0.35 }} />
      </aside>

      {/* ── Right panel — bare form, no card wrapper ── */}
      <main
        className="flex-1 flex flex-col min-h-screen"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        {/* Mobile brand strip */}
        <div className="lg:hidden flex items-center justify-center pt-8 pb-2">
          <Link
            href="/login"
            className="text-[22px] font-bold tracking-tight anim-fade-down"
            style={{ color: "var(--navy)", fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
          </Link>
        </div>

        {/* Form area — no card, white inputs contrast naturally on --page-bg */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-[400px] anim-fade-up anim-d-100">
            {children}

            <p
              className="mt-8 text-center text-[11px]"
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
