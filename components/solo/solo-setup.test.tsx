import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { countPools } from "@/lib/puzzles/pools";
import { SoloSetup } from "./solo-setup";

describe("SoloSetup", () => {
  it("says there are no puzzles yet and offers no Start link", () => {
    const html = renderToStaticMarkup(<SoloSetup pools={countPools([])} />);
    expect(html).toContain("No puzzles yet");
    expect(html).not.toContain("/solo/play");
  });

  it("shows the pool size and a Start link when the pool has puzzles", () => {
    const pools = countPools([
      { language: "javascript", level: "easy" },
      { language: "javascript", level: "easy" },
    ]);
    const html = renderToStaticMarkup(<SoloSetup pools={pools} />);
    expect(html).toContain("2 puzzles in this pool.");
    expect(html).toContain("/solo/play");
  });
});
