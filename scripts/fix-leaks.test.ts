import { describe, expect, it } from "vitest";
import { findFixLeaks, unescapeLiterals } from "./fix-leaks";

const fix = `function clampScore(score, min, max) {
  if (score < min) return min;
  if (score > max) return max;
  return "ok";
}
`;
const fixes = [{ id: "clamp-score", fix }];

describe("findFixLeaks", () => {
  it.each([
    ["a JSON string", `var a=${JSON.stringify(fix)};`],
    [
      "a single-quoted string",
      `var a='${fix.replaceAll("\n", "\\n").replaceAll("'", "\\'")}';`,
    ],
    ["a template literal", `var a=\`${fix}\`;`],
  ])("finds a fix bundled as %s", (_, content) => {
    expect(
      findFixLeaks(fixes, [{ file: "static/chunks/a.js", content }]),
    ).toEqual([{ id: "clamp-score", file: "static/chunks/a.js" }]);
  });

  it("ignores the buggy code and other text", () => {
    const buggy = fix.replace("return min;", "return max;");
    expect(
      findFixLeaks(fixes, [
        { file: "static/chunks/game.js", content: JSON.stringify(buggy) },
      ]),
    ).toEqual([]);
  });
});

describe("unescapeLiterals", () => {
  it("undoes string escapes", () => {
    expect(unescapeLiterals(String.raw`a\nb\t\"c\" \'d\' \\e`)).toBe(
      "a\nb\t\"c\" 'd' \\e",
    );
  });
});
