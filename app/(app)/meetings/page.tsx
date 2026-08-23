import { Suspense } from "react";
import { MeetingsContent } from "./content";

export default function MeetingsPage() {
  return (
    <Suspense>
      <MeetingsContent />
    </Suspense>
  );
}
