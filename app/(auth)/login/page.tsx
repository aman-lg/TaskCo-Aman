import { Suspense } from "react";
import { LoginContent } from "./content";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
