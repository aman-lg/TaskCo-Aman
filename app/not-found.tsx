import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--page-bg)" }}>
      <p className="eyebrow">404</p>
      <h1 className="h1" style={{ color: "var(--ink)" }}>Page not found</h1>
      <p style={{ color: "var(--text-secondary)" }}>The page you are looking for does not exist.</p>
      <Link
        href="/dashboard"
        className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
        style={{ backgroundColor: "var(--navy)" }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
