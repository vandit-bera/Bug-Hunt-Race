import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig } from "./config";
import type { Database } from "./types";

export type DbClient = SupabaseClient<Database>;

/**
 * Supabase client for the browser, using the public URL and publishable
 * (anon) key. Row-level security protects the data, not the key.
 */
export function createBrowserDbClient(): DbClient {
  const { url, key } = publicConfig();
  return createClient<Database>(url, key);
}

/**
 * Supabase client for server code that acts as one player: requests carry
 * that player's access token, so row-level security and `auth.uid()` apply
 * exactly as in their browser. Nothing is stored between requests.
 */
export function createUserDbClient(accessToken: string): DbClient {
  const { url, key } = publicConfig();
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publicConfig(): { url: string; key: string } {
  const config = readSupabaseConfig();
  if (!config.ok) throw new Error(config.problem);
  return config;
}

/**
 * Players have no accounts: each browser gets an anonymous Supabase user, and
 * row-level security keys off that user's id. Call before creating or joining
 * a room. Reuses the stored session, so a player who reloads keeps their seat.
 */
export async function ensureSignedIn(client: DbClient): Promise<string> {
  const userId = await getSignedInUserId(client);
  if (userId) return userId;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user.");
  return data.user.id;
}

/**
 * The stored anonymous user, or null if this browser never signed in. Unlike
 * `ensureSignedIn`, never creates a user.
 */
export async function getSignedInUserId(
  client: DbClient,
): Promise<string | null> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}
