import type { Metadata } from "next";
import { Homepage } from "@/components/marketing/homepage";

export const metadata: Metadata = {
  title: "TaskCo — AI-powered team task management",
  description: "Projects, tasks, chat, and Ask Tasko — an AI assistant grounded in your team's real work.",
};

export default function RootPage() {
  return <Homepage />;
}
