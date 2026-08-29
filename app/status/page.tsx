import type { Metadata } from "next";
import { StatusContent } from "./status-content";

export const metadata: Metadata = {
  title: "System Status — TaskCo",
  description: "Live status of TaskCo's core services.",
};

export default function StatusPage() {
  return <StatusContent />;
}
