import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      {/* Brand mark */}
      <Link href="/login" className="mb-8 font-extrabold text-2xl tracking-tight" style={{ color: "var(--navy)" }}>
        Task<span style={{ color: "var(--accent-brand)" }}>Co</span>
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-[400px] rounded-xl p-8"
        style={{
          backgroundColor: "var(--surface-bg)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
        Internal tool · Not for public access
      </p>
    </div>
  );
}
