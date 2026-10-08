import { describe, expect, it } from "vitest";
import { DEFAULT_RUN_TIMEOUT_MS, LANGUAGES } from "@/lib/runner";

describe("runner config", () => {
  it("uses the 5s timeout from the plan", () => {
    expect(DEFAULT_RUN_TIMEOUT_MS).toBe(5_000);
  });

  it("keys every language by its own id", () => {
    for (const [key, config] of Object.entries(LANGUAGES)) {
      expect(config.id).toBe(key);
    }
  });

  it("supports the v1 languages", () => {
    expect(Object.keys(LANGUAGES).sort()).toEqual([
      "javascript",
      "python",
      "typescript",
    ]);
  });
});
