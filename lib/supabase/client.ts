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

    // Every realtime channel in the app (chat messages/presence, dashboard,
    // project activity) authorizes its WebSocket once, at subscribe time,
    // by calling realtime.setAuth() with the current access token. The
    // underlying `supabase.auth` session silently refreshes that token in
    // the background before it expires, but nothing was propagating the
    // new token to the already-open Realtime socket — so postgres_changes
    // and presence events would pass RLS right after login and then start
    // silently failing it (and getting dropped) once the original token
    // aged out, with no error surfaced anywhere. This keeps the socket's
    // auth in sync for as long as the client lives, not just at first
    // subscribe.
    client.auth.onAuthStateChange((_event, session) => {
      if (session) client!.realtime.setAuth(session.access_token);
    });
  }
  return client;
}
