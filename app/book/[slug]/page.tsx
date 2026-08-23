import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingClient } from "@/components/meetings/booking-client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookPage({ params }: PageProps) {
  const { slug } = await params;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: host } = await (admin as any)
    .from("profiles")
    .select("full_name")
    .eq("booking_slug", slug)
    .maybeSingle();

  if (!host) notFound();

  return <BookingClient slug={slug} hostName={host.full_name ?? "this host"} />;
}
