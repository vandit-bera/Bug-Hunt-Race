import { describe, expect, it } from "vitest";
import { parseSoloParams, soloPlayHref } from "./solo-params";

const parse = (query: string) => parseSoloParams(new URLSearchParams(query));

describe("parseSoloParams", () => {
  it("reads language, level and round", () => {
    expect(parse("language=python&level=mixed&round=2")).toEqual({
      language: "python",
      level: "mixed",
      round: 2,
    });
  });

  it("defaults the round to 0", () => {
    expect(parse("language=javascript&level=easy")?.round).toBe(0);
  });

  it.each([
    "level=easy",
    "language=ruby&level=easy",
    "language=python&level=insane",
    "language=python&level=easy&round=-1",
    "language=python&level=easy&round=x",
  ])("rejects %s", (query) => {
    expect(parse(query)).toBeNull();
  });

  it("builds a link that parses back", () => {
    const params = { language: "typescript", level: "hard", round: 3 } as const;
    expect(parse(soloPlayHref(params).split("?")[1])).toEqual(params);
  });
});
