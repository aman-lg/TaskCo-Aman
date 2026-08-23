import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Singleton — every caller shares one client (and one Realtime socket)
// instead of each hook/component creating its own. Multiple independent
// clients meant multiple independent session-hydration races: a channel
// subscribed before ITS OWN client finished loading the session would open
// its WebSocket authorized as `anon`, and RLS would then silently drop every
// event for it (regular REST calls didn't show this since they always wait
// for the session before firing).
let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
