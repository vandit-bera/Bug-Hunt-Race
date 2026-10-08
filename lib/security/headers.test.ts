import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  securityHeaders,
  supabaseOrigins,
} from "./headers";

function directive(csp: string, name: string): string[] {
  const found = csp.split("; ").find((part) => part.split(" ")[0] === name);
  return found ? found.split(" ").slice(1) : [];
}

describe("supabaseOrigins", () => {
  it("allows the REST origin and the Realtime socket", () => {
    expect(supabaseOrigins("https://abc.supabase.co")).toEqual([
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
    ]);
  });

  it("uses ws: for a local http Supabase, keeping the port", () => {
    expect(supabaseOrigins("http://127.0.0.1:54321/")).toEqual([
      "http://127.0.0.1:54321",
      "ws://127.0.0.1:54321",
    ]);
  });

  it("drops a path", () => {
    expect(supabaseOrigins("https://abc.supabase.co/rest/v1")).toEqual([
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
    ]);
  });

  it("ignores a missing, invalid or non-http URL", () => {
    expect(supabaseOrigins(undefined)).toEqual([]);
    expect(supabaseOrigins("")).toEqual([]);
    expect(supabaseOrigins("not a url")).toEqual([]);
    expect(supabaseOrigins("javascript:alert(1)")).toEqual([]);
  });
});

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy({
    supabaseUrl: "https://abc.supabase.co",
    isDev: false,
  });

  it("only connects to this site and Supabase", () => {
    expect(directive(prod, "connect-src")).toEqual([
      "'self'",
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
    ]);
  });

  it("blocks framing, plugins and base/form hijacking", () => {
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(prod, "object-src")).toEqual(["'none'"]);
    expect(directive(prod, "base-uri")).toEqual(["'self'"]);
    expect(directive(prod, "form-action")).toEqual(["'self'"]);
  });

  it("allows eval only in development", () => {
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
    expect(
      directive(
        contentSecurityPolicy({ supabaseUrl: undefined, isDev: true }),
        "script-src",
      ),
    ).toContain("'unsafe-eval'");
  });

  it("loads scripts from this site only", () => {
    expect(directive(prod, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
    ]);
    expect(directive(prod, "worker-src")).toEqual(["'self'"]);
  });
});

describe("securityHeaders", () => {
  it("sets every header once", () => {
    const keys = securityHeaders({ supabaseUrl: undefined, isDev: false }).map(
      (h) => h.key,
    );
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
    ]);
  });
});
