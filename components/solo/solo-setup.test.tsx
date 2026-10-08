import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/puzzles/generated", () => ({ PUZZLES: [] }));

describe("SoloSetup with no puzzles", () => {
  it("says there are no puzzles yet and offers no Start link", async () => {
    const { SoloSetup } = await import("./solo-setup");
    const html = renderToStaticMarkup(<SoloSetup />);
    expect(html).toContain("No puzzles yet");
    expect(html).not.toContain("/solo/play");
  });
});
