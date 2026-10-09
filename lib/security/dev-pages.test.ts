import { describe, expect, it } from "vitest";
import { devPagesEnabled } from "./dev-pages";

describe("devPagesEnabled", () => {
  it("hides the dev pages on the live (production) deployment", () => {
    expect(devPagesEnabled("production")).toBe(false);
  });

  it.each([undefined, "", "preview", "development"])(
    "keeps them for local runs, CI and previews (VERCEL_ENV=%s)",
    (vercelEnv) => {
      expect(devPagesEnabled(vercelEnv)).toBe(true);
    },
  );
});
