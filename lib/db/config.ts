/**
 * The public Supabase settings, read and checked in one place. No Supabase
 * imports here: `next.config.ts` uses this too.
 */

export type SupabaseConfig =
  | { ok: true; url: string; key: string }
  /** `missing`: neither variable is set, the expected state without a database. */
  | { ok: false; missing: boolean; problem: string };

// Supabase appends these itself, so a URL copied from an API page ends up
// doubled (`…/rest/v1/rest/v1/…`) and every request 404s.
const SERVICE_PATH = /\/(?:rest|auth|realtime)\/v1$/i;

/**
 * `https://<ref>.supabase.co/rest/v1/ ` → `https://<ref>.supabase.co`: trims
 * spaces and trailing slashes and drops a trailing `/rest/v1`, `/auth/v1` or
 * `/realtime/v1`. Null unless the result is a plain http(s) URL.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const trimmed = (raw ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(SERVICE_PATH, "")
    .replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname || url.username || url.password) return null;
  if (url.search || url.hash) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

/**
 * Checks the Supabase variables. Problems name the variable but never echo a
 * value, so they are safe to log and to show. The `process.env` reads must
 * stay literal: Next inlines `NEXT_PUBLIC_*` into browser code only then.
 */
export function readSupabaseConfig(
  rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): SupabaseConfig {
  const key = rawKey?.trim() ?? "";
  const hasUrl = Boolean(rawUrl?.trim());
  if (!hasUrl && !key) {
    return {
      ok: false,
      missing: true,
      problem:
        "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    };
  }
  const problems: string[] = [];
  const url = normalizeSupabaseUrl(rawUrl);
  if (!hasUrl) {
    problems.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  } else if (!url) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Use the Project URL from Supabase → Project Settings → API, like https://<ref>.supabase.co.",
    );
  }
  if (!key) problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  if (!url || problems.length > 0) {
    return {
      ok: false,
      missing: false,
      problem: `Supabase is misconfigured: ${problems.join(" ")}`,
    };
  }
  return { ok: true, url, key };
}
