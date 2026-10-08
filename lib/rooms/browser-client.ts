import { createBrowserDbClient, type DbClient } from "@/lib/db";

let client: DbClient | undefined;

/** Whether the public Supabase variables are set (see .env.example). */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * The tab's one Supabase client, shared by the room screens: a second client
 * would make Supabase Auth warn about competing sessions. Browser only.
 */
export function getBrowserDbClient(): DbClient {
  client ??= createBrowserDbClient();
  return client;
}
