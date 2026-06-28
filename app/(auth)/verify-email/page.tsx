import { Suspense } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { VerifyEmailContent } from "./content";

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div
        className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--navy-50)" }}
      >
        <MailCheck className="h-7 w-7" style={{ color: "var(--navy)" }} />
      </div>

      <Suspense fallback={
        <div>
          <p className="eyebrow mb-1">Almost there</p>
          <h1 className="h1" style={{ color: "var(--ink)" }}>Verify your email</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            We sent a verification link to your email address. Click the link to activate your account.
          </p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>

      <div
        className="w-full rounded-lg p-4 text-left text-sm"
        style={{ backgroundColor: "var(--accent-bg)", border: "1px solid var(--accent-bd)" }}
      >
        <p className="font-semibold mb-1" style={{ color: "var(--accent-d)" }}>What to do next</p>
        <ol className="list-decimal list-inside space-y-1" style={{ color: "var(--text-secondary)" }}>
          <li>Check your inbox (and spam folder)</li>
          <li>Click the &ldquo;Confirm your email&rdquo; link</li>
          <li>You&apos;ll be signed in automatically</li>
        </ol>
      </div>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Wrong email?{" "}
        <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Register again
        </Link>{" "}
        ·{" "}
        <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--navy)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
