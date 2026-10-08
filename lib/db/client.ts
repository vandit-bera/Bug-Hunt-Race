import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DbClient = SupabaseClient<Database>;

/**
 * Supabase client for the browser, using the public URL and publishable
 * (anon) key. Row-level security protects the data, not the key.
 */
export function createBrowserDbClient(): DbClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return createClient<Database>(url, key);
}

/**
 * Players have no accounts: each browser gets an anonymous Supabase user, and
 * row-level security keys off that user's id. Call before creating or joining
 * a room. Reuses the stored session, so a player who reloads keeps their seat.
 */
export async function ensureSignedIn(client: DbClient): Promise<string> {
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonymous sign-in returned no user.");
  return data.user.id;
}
