"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
  type Variants,
} from "motion/react";
import {
  ArrowRight,
  Sparkles,
  KanbanSquare,
  MessageSquare,
  CalendarClock,
  ShieldCheck,
  Users,
  Mic,
  Menu,
  X,
} from "lucide-react";

export interface MarketingCurrentUser {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

function initials(user: MarketingCurrentUser): string {
  if (user.name) return user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  return (user.email?.[0] ?? "?").toUpperCase();
}

// ---------------------------------------------------------------------------
// Shared motion variants
// ---------------------------------------------------------------------------

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

// ---------------------------------------------------------------------------
// Ambient floating glow — continuously drifting, so there's always visible
// motion on screen even before you scroll or hover anything.
// ---------------------------------------------------------------------------

function FloatingGlow({
  color,
  size,
  className,
  duration = 12,
}: {
  color: string;
  size: number;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className ?? ""}`}
      style={{ background: color, width: size, height: size }}
      animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Header — floating, inset (never full-width), glassy over the dark hero
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { href: "#why", label: "Why TaskCo" },
  { href: "#ai", label: "Ask Tasko" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

function SiteHeader({ currentUser }: { currentUser: MarketingCurrentUser | null }) {
  // Genuinely transparent over the dark hero (blends right in), but as you
  // scroll past it into the light sections below, the pill gains a solid
  // navy backing — a see-through white tint here would otherwise wash out
  // to near-invisible white-on-white text against a light section.
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 400], ["rgba(25,24,59,0)", "rgba(19,18,46,0.92)"]);
  const borderColor = useTransform(scrollY, [0, 400], ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.08)"]);
  const shadow = useTransform(scrollY, [0, 400], ["0 0 0 rgba(0,0,0,0)", "0 8px 30px rgba(0,0,0,0.25)"]);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-4 inset-x-4 sm:top-5 sm:inset-x-8 lg:inset-x-16 z-50">
      <motion.div
        className="mx-auto max-w-5xl flex items-center justify-between gap-4 px-4 sm:px-5 py-2.5 rounded-full border"
        style={{
          background: bg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderColor,
          boxShadow: shadow,
        }}
      >
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <motion.div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "#CE7E37" }}
            whileHover={{ rotate: 8, scale: 1.08 }}
          >
            <span className="text-white font-black text-[13px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
          </motion.div>
          <span className="font-bold text-[16px] leading-none text-white hidden sm:inline" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
            Task<span style={{ color: "#CE7E37" }}>Co</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[13.5px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
          ))}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0">
          {currentUser ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: "#CE7E37", color: "white" }}
                  >
                    {initials(currentUser)}
                  </span>
                )}
                <span className="text-[13.5px] font-semibold text-white hidden sm:inline max-w-[120px] truncate">
                  {currentUser.name ?? currentUser.email ?? "Dashboard"}
                </span>
              </Link>
            </motion.div>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-full text-[13.5px] font-semibold transition-colors"
                style={{ color: "white", background: "rgba(255,255,255,0.1)" }}
              >
                Log in
              </Link>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13.5px] font-bold"
                  style={{ background: "#CE7E37", color: "white" }}
                >
                  Join Now
                </Link>
              </motion.div>
            </>
          )}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full"
            style={{ color: "white", background: "rgba(255,255,255,0.1)" }}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="md:hidden mx-auto max-w-5xl mt-2 rounded-2xl border p-4 flex flex-col gap-1"
            style={{ background: "rgba(19,18,46,0.97)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href={currentUser ? "/dashboard" : "/login"}
              className="mt-2 px-3 py-2.5 rounded-lg text-[14px] font-semibold text-center"
              style={{ color: "white", background: "rgba(255,255,255,0.08)" }}
            >
              {currentUser ? "Go to Dashboard" : "Log in"}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero — dark navy, headline + CTA, mouse-tilt animated dashboard mockup
// ---------------------------------------------------------------------------

// SVG ring that draws itself in — replaces a static conic-gradient with an
// actually-animating progress indicator.
function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="-rotate-90">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
      <motion.circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="#CE7E37"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        whileInView={{ strokeDashoffset: circumference * (1 - pct / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function DashboardMockup() {
  // Mouse-tilt: the card leans toward the cursor, easing back to flat when
  // the pointer leaves — the classic "premium product shot" interaction.
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 150, damping: 18 });
  const springY = useSpring(rotateY, { stiffness: 150, damping: 18 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 10);
    rotateX.set(py * -10);
  }
  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-2xl border overflow-hidden"
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}
        />
        {/* window chrome */}
        <div className="relative flex items-center gap-1.5 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#DC2626" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#D97706" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#16A34A" }} />
          <span className="ml-3 flex items-center gap-1.5 text-[10.5px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
            <motion.span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#16A34A" }}
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            live
          </span>
        </div>

        <div className="relative p-4 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4" style={{ transform: "translateZ(20px)" }}>
          {/* left: task list */}
          <div className="col-span-2 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Today</span>
              <span className="w-14 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>
            {[
              { label: "Design new logo", tag: "Design", tagColor: "#A1C2BD", done: true },
              { label: "Ship pricing page", tag: "Urgent", tagColor: "#F0A56B", done: false },
              { label: "Client onboarding call", tag: "Today", tagColor: "#8BAAA6", done: false },
            ].map((row, i) => (
              <div key={row.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <motion.span
                  className="w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center"
                  style={{ border: "1.5px solid rgba(255,255,255,0.25)" }}
                  initial={{ background: "rgba(0,0,0,0)", borderColor: "rgba(255,255,255,0.25)" }}
                  animate={row.done ? { background: "#16A34A", borderColor: "#16A34A" } : {}}
                  transition={{ delay: 1.4 + i * 0.15, duration: 0.3 }}
                >
                  {row.done && (
                    <motion.svg
                      width="9" height="9" viewBox="0 0 12 12" fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 1.6, duration: 0.3 }}
                    >
                      <motion.path d="M2 6L5 9L10 3" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                </motion.span>
                <span className="flex-1 min-w-0 truncate text-[12.5px] font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{row.label}</span>
                <span
                  className="text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: `${row.tagColor}22`, color: row.tagColor }}
                >
                  {row.tag}
                </span>
              </div>
            ))}

            {/* Ask Tasko insight strip */}
            <motion.div
              className="mt-1 flex items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(206,126,55,0.1)", border: "1px solid rgba(206,126,55,0.25)" }}
              animate={{ boxShadow: ["0 0 0 rgba(206,126,55,0)", "0 0 16px rgba(206,126,55,0.25)", "0 0 0 rgba(206,126,55,0)"] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#CE7E37" }} />
              <p className="text-[11.5px] leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>
                <span className="font-bold" style={{ color: "#F0A56B" }}>Tasko: </span>
                2 tasks are due today — want me to notify the assignees?
              </p>
            </motion.div>
          </div>

          {/* right: mini stats */}
          <div className="flex flex-col gap-2.5">
            {[
              { label: "Active", value: 12 },
              { label: "Done", value: 48 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-[18px] font-bold" style={{ color: "white", fontFamily: "var(--font-display)" }}>{s.value}</p>
                <p className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
              </div>
            ))}
            <div className="flex-1 rounded-xl px-3 py-3 flex flex-col items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              <ProgressRing pct={65} />
              <p className="text-[9.5px] font-medium mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>65% on track</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AnimatedHeadline() {
  const line1 = ["Task", "management", "that", "actually"];
  const line2 = [{ text: "keeps up", accent: true }, { text: "with", accent: false }, { text: "your", accent: false }, { text: "team.", accent: false }];
  return (
    <motion.h1
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.1 } } }}
      className="text-[36px] sm:text-[52px] lg:text-[62px] font-bold leading-[1.05] tracking-tight text-white max-w-4xl"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {line1.map((w, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0, y: 30, rotateX: -40 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          className="inline-block mr-[0.28em]"
        >
          {w}
        </motion.span>
      ))}
      <br className="hidden sm:block" />
      {line2.map((w, i) => (
        <motion.span
          key={i}
          variants={{ hidden: { opacity: 0, y: 30, rotateX: -40 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
          className="inline-block mr-[0.28em]"
          style={w.accent ? { color: "#CE7E37" } : undefined}
        >
          {w.text}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function Hero({ currentUser }: { currentUser: MarketingCurrentUser | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.25]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pt-36 pb-28 sm:pt-44 sm:pb-36 px-6"
      style={{
        background: "radial-gradient(120% 100% at 50% -10%, #262555 0%, #19183B 55%, #100F26 100%)",
      }}
    >
      {/* ambient glows — continuously drifting, always in motion */}
      <FloatingGlow color="#CE7E37" size={380} className="-top-24 -left-24 opacity-20" duration={14} />
      <FloatingGlow color="#A1C2BD" size={440} className="top-40 -right-32 opacity-[0.12]" duration={18} />

      <div className="relative max-w-5xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold mb-6"
          style={{ background: "rgba(255,255,255,0.08)", color: "#F0A56B", border: "1px solid rgba(206,126,55,0.3)" }}
        >
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
            <Sparkles className="w-3 h-3" />
          </motion.span>
          Now with Ask Tasko, your built-in AI teammate
        </motion.div>

        <AnimatedHeadline />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="mt-5 text-[15.5px] sm:text-[17px] max-w-xl leading-relaxed"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          Projects, tasks, chat, attendance, and an AI assistant that actually knows your
          data — in one place, built for teams who'd rather be working than managing.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={currentUser ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14.5px] font-bold relative"
              style={{ background: "#CE7E37", color: "white" }}
            >
              <motion.span
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 rgba(206,126,55,0.5)" }}
                animate={{ boxShadow: ["0 0 0px rgba(206,126,55,0.5)", "0 0 22px rgba(206,126,55,0.5)", "0 0 0px rgba(206,126,55,0.5)"] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <span className="relative">{currentUser ? "Go to Dashboard" : "Join Now"}</span>
              <ArrowRight className="w-4 h-4 relative" />
            </Link>
          </motion.div>
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            href="#ai"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14.5px] font-semibold transition-colors"
            style={{ color: "white", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            See Ask Tasko in action
          </motion.a>
        </motion.div>

        <motion.div
          style={{ y: mockupY, opacity: mockupOpacity }}
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 w-full max-w-3xl"
        >
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Why TaskCo — feature grid, with 3D hover tilt
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: KanbanSquare, title: "Projects & tasks", desc: "Kanban boards, deadlines, urgency, checklists, and file attachments — all scoped to departments and sub-departments." },
  { icon: Sparkles, title: "Ask Tasko, built in", desc: "An AI assistant that answers real questions about your real tasks and projects — and only ever acts after you confirm." },
  { icon: MessageSquare, title: "Team chat", desc: "Direct messages, groups, voice notes, polls, and voice calls — without leaving the app to coordinate work." },
  { icon: CalendarClock, title: "Calendar & meetings", desc: "Google Calendar sync and booking links, so scheduling a call is one link, not five messages." },
  { icon: Users, title: "Org chart aware", desc: "Departments and sub-departments are first-class — assign a whole team, not just one person at a time." },
  { icon: ShieldCheck, title: "Built on real permissions", desc: "Row-level security throughout — people only ever see what they're actually meant to." },
];

function FeatureCard({ f }: { f: (typeof FEATURES)[number] }) {
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    rotateY.set(((e.clientX - rect.left) / rect.width - 0.5) * 8);
    rotateX.set(((e.clientY - rect.top) / rect.height - 0.5) * -8);
  }
  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      variants={fadeUp}
      style={{ perspective: 800 }}
    >
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ y: -6 }}
        className="rounded-2xl p-6 border transition-shadow hover:shadow-xl"
        style={{
          rotateX: springX,
          rotateY: springY,
          transformStyle: "preserve-3d",
          background: "var(--surface-bg)",
          borderColor: "var(--line)",
        }}
      >
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "var(--accent-bg)" }}
          whileHover={{ rotate: 12, scale: 1.1 }}
        >
          <f.icon className="w-5 h-5" style={{ color: "var(--navy)" }} />
        </motion.div>
        <h3 className="text-[15.5px] font-bold mb-1.5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>{f.title}</h3>
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
      </motion.div>
    </motion.div>
  );
}

function Features() {
  return (
    <section id="why" className="relative py-24 sm:py-32 px-6" style={{ background: "var(--page-bg)" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Why TaskCo</span>
          <h2 className="mt-3 text-[28px] sm:text-[36px] font-bold leading-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Everything your team needs to stop losing track of things.
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} f={f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ask Tasko spotlight — chat demo that types, then speaks, in sequence
// ---------------------------------------------------------------------------

const CHAT_TURNS = [
  { from: "user", text: "What tasks are overdue right now?" },
  { from: "tasko", text: "One: \"Fix payment gateway timeout\" — urgent, 3 days overdue, unassigned." },
  { from: "user", text: "Assign it to everyone in the Backend team." },
  { from: "tasko", text: "Got it — I'll assign it to 3 people. Confirm?" },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.5)" }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

function AiChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [step, setStep] = useState(0); // how many turns fully revealed
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    async function sequence() {
      for (let i = 0; i < CHAT_TURNS.length; i++) {
        if (cancelled) return;
        if (CHAT_TURNS[i].from === "tasko") {
          setTyping(true);
          await new Promise((r) => setTimeout(r, 700));
          if (cancelled) return;
          setTyping(false);
        } else {
          await new Promise((r) => setTimeout(r, 450));
        }
        if (cancelled) return;
        setStep(i + 1);
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    sequence();
    return () => { cancelled = true; };
  }, [inView]);

  return (
    <div ref={ref} className="rounded-2xl border p-5 flex flex-col gap-3 min-h-[280px]" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: "#CE7E37" }}
          animate={{ scale: typing ? [1, 1.15, 1] : 1 }}
          transition={{ duration: 0.6, repeat: typing ? Infinity : 0 }}
        >
          <Sparkles className="w-3 h-3 text-white" />
        </motion.div>
        <span className="text-[13px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Tasko AI</span>
        <Mic className="w-3.5 h-3.5 ml-auto" style={{ color: "rgba(255,255,255,0.3)" }} />
      </div>

      <AnimatePresence initial={false}>
        {CHAT_TURNS.slice(0, step).map((turn, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`flex ${turn.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] px-3.5 py-2 rounded-2xl text-[12.5px] leading-snug"
              style={
                turn.from === "user"
                  ? { background: "#CE7E37", color: "white" }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.9)" }
              }
            >
              {turn.text}
            </div>
          </motion.div>
        ))}
        {typing && (
          <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-start">
            <TypingDots />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AiSpotlight() {
  return (
    <section id="ai" className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "#19183B" }}>
      <FloatingGlow color="#CE7E37" size={576} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08]" duration={16} />

      <div className="relative max-w-5xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.span variants={fadeUp} className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "#F0A56B" }}>
            Meet Ask Tasko
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="mt-3 text-[28px] sm:text-[36px] font-bold leading-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            An AI teammate that actually knows your work.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
            Ask it what's overdue, who's overloaded, or what happened on a project last
            week — grounded in your real tasks, not a guess. Ask it to create or assign
            work, and it always shows you exactly what it's about to do first.
          </motion.p>

          <motion.ul variants={stagger} className="mt-7 flex flex-col gap-3.5">
            {[
              "Answers grounded in your actual tasks, projects, and files",
              "Assigns whole departments in one request — not person by person",
              "Never changes anything without your explicit confirmation",
              "Free, live voice-note transcription while you record",
            ].map((item) => (
              <motion.li key={item} variants={fadeUp} className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#CE7E37" }} />
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <AiChatDemo />
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final CTA + footer
// ---------------------------------------------------------------------------

function FinalCta({ currentUser }: { currentUser: MarketingCurrentUser | null }) {
  return (
    <section id="about" className="relative py-24 sm:py-32 px-6" style={{ background: "var(--page-bg)" }}>
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={fadeUp}
        className="relative max-w-3xl mx-auto text-center rounded-3xl px-8 py-16 sm:py-20 overflow-hidden"
        style={{ background: "#19183B" }}
      >
        <FloatingGlow color="#CE7E37" size={320} className="-top-20 -right-20 opacity-[0.15]" duration={10} />
        <h2 className="relative text-[28px] sm:text-[38px] font-bold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
          {currentUser ? `Welcome back, ${currentUser.name?.split(" ")[0] ?? "there"}.` : "Ready to get your team organized?"}
        </h2>
        <p className="relative mt-4 text-[15px] max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
          {currentUser
            ? "Pick up right where you left off."
            : "Set up your workspace in minutes — projects, chat, and Ask Tasko, ready to go."}
        </p>
        <motion.div className="relative inline-block mt-8" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
          <Link
            href={currentUser ? "/dashboard" : "/register"}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-bold"
            style={{ background: "#CE7E37", color: "white", boxShadow: "0 8px 24px rgba(206,126,55,0.35)" }}
          >
            {currentUser ? "Go to Dashboard" : "Join Now"} <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-8 border-t" style={{ background: "var(--surface-bg)", borderColor: "var(--line)" }}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#CE7E37" }}>
            <span className="text-white font-black text-[11px]" style={{ fontFamily: "var(--font-display)" }}>T</span>
          </div>
          <span className="font-bold text-[14px]" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Task<span style={{ color: "#CE7E37" }}>Co</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/status" className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--text-muted)" }}>
            System Status
          </Link>
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} TaskCo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function Homepage({ currentUser = null }: { currentUser?: MarketingCurrentUser | null }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--page-bg)" }}>
      <SiteHeader currentUser={currentUser} />
      <Hero currentUser={currentUser} />
      <Features />
      <AiSpotlight />
      <FinalCta currentUser={currentUser} />
      <Footer />
    </div>
  );
}
