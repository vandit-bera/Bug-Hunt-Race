/**
 * Security headers for every page (see next.config.ts and
 * docs/ARCHITECTURE.md#security-headers).
 */

/** `https://x.supabase.co` → the REST origin and its Realtime (`wss`) origin. */
export function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];
  const socket = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${socket}//${url.host}`];
}

/**
 * Page CSP. No nonces: they force every page to render per request (no static
 * pages, no CDN cache), so inline scripts are allowed instead. The inline ones
 * are the theme script in <head> and Next's RSC payload. `'unsafe-eval'` is
 * only for `next dev` (React's error overlay). Workers are same-origin and get
 * their own, stricter CSP from their script response.
 */
export function contentSecurityPolicy({
  supabaseUrl,
  isDev,
}: {
  supabaseUrl: string | undefined;
  isDev: boolean;
}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseOrigins(supabaseUrl)],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/** Browser features the game never uses. Fullscreen and clipboard stay on. */
export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

export function securityHeaders(options: {
  supabaseUrl: string | undefined;
  isDev: boolean;
}): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    // For browsers without CSP frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
