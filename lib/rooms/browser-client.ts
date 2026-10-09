import {
  createBrowserDbClient,
  readSupabaseConfig,
  type DbClient,
} from "@/lib/db";

let client: DbClient | undefined;

/**
 * Whether the public Supabase variables are set and valid (see
 * .env.example). A wrong value is logged (build and server logs, the browser
 * console) rather than surfacing later as 404s.
 */
export function isDbConfigured(): boolean {
  const config = readSupabaseConfig();
  if (!config.ok && !config.missing) console.error(config.problem);
  return config.ok;
}

/**
 * The tab's one Supabase client, shared by the room screens: a second client
 * would make Supabase Auth warn about competing sessions. Browser only.
 */
export function getBrowserDbClient(): DbClient {
  client ??= createBrowserDbClient();
  return client;
}
