import { Suspense } from "react";
import { VerifyEmailContent } from "./content";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="text-center">
        <h1 className="h1">Check your email</h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          A verification link has been sent to your email address.
        </p>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
