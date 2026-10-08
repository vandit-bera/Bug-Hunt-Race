import { createBrowserDbClient, type DbClient } from "@/lib/db";

let shared: DbClient | null | undefined;

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * The one Supabase client for this browser tab, or null when Supabase is not
 * configured. Shared so every room screen uses one auth session: two clients
 * in a tab log a "multiple GoTrueClient instances" warning. On the server
 * (prerendering a client component) it returns a throwaway client, never a
 * shared one.
 */
export function getBrowserDbClient(): DbClient | null {
  if (typeof window === "undefined") {
    return isConfigured() ? createBrowserDbClient() : null;
  }
  if (shared === undefined) {
    shared = isConfigured() ? createBrowserDbClient() : null;
  }
  return shared;
}
