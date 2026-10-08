import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const css = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

function readTokens(selector: string): Record<string, string> {
  const block = css.split(selector)[1]?.split("}")[0] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

const themes = {
  light: readTokens(':root,\n[data-theme="light"] {'),
  dark: readTokens('[data-theme="dark"] {'),
};

const textOnBackgrounds = [
  "foreground",
  "muted",
  "primary",
  "accent",
  "success",
  "danger",
  "warning",
  "level-easy",
  "level-medium",
  "level-hard",
];

const filledPairs: [string, string][] = [
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["accent-foreground", "accent"],
  ["danger-foreground", "danger"],
];

describe.each(Object.entries(themes))("%s theme contrast", (_name, tokens) => {
  it("defines every token", () => {
    for (const key of [...textOnBackgrounds, "background", "surface", "ring"]) {
      expect(tokens[key], key).toBeDefined();
    }
  });

  it.each(["background", "surface", "surface-raised"])(
    "text tokens meet 4.5:1 on %s",
    (bg) => {
      for (const key of textOnBackgrounds) {
        expect(
          contrastRatio(tokens[key], tokens[bg]),
          `${key} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("filled controls meet 4.5:1 for their label", () => {
    for (const [fg, bg] of filledPairs) {
      expect(
        contrastRatio(tokens[fg], tokens[bg]),
        `${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("borders and focus ring meet 3:1 against the page", () => {
    expect(
      contrastRatio(tokens.border, tokens.background),
    ).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.border, tokens.surface)).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      contrastRatio(tokens.ring, tokens.background),
    ).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.ring, tokens.surface)).toBeGreaterThanOrEqual(
      3,
    );
  });
});
