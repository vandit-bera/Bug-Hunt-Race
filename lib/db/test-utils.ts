import { vi } from "vitest";
import type { DbClient } from "./client";

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Minimal stand-in for the Supabase client: `rpc()` and `from()` queries
 * resolve to queued results, and every call is recorded for assertions.
 */
export function createFakeClient(results: {
  rpc?: FakeResult[];
  from?: FakeResult[];
}) {
  const rpcResults = [...(results.rpc ?? [])];
  const fromResults = [...(results.from ?? [])];
  const queries: { table: string; calls: [string, unknown[]][] }[] = [];

  const rpc = vi.fn(
    async () => rpcResults.shift() ?? { data: null, error: null },
  );

  const from = vi.fn((table: string) => {
    const query = { table, calls: [] as [string, unknown[]][] };
    queries.push(query);
    const result = fromResults.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: FakeResult) => unknown) => resolve(result),
    };
    for (const method of ["select", "eq", "order", "single"]) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push([method, args]);
        return builder;
      };
    }
    return builder;
  });

  // The fake implements only the methods lib/db uses.
  const client = { rpc, from } as unknown as DbClient;
  return { client, rpc, from, queries };
}
