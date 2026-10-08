import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUZZLE_CATALOG_FILE, renderPuzzleCatalogSql } from "./catalog-sql";
import { PUZZLE_FIXES_FILE, renderPuzzleFixes } from "./fixes-file";
import { GENERATED_PUZZLE_FILES } from "./generated-files";
import { loadPuzzles, type PuzzleSource } from "./load";

const sources = loadPuzzles("puzzles").flatMap(({ puzzle }) =>
  puzzle ? [puzzle] : [],
);

describe("generated puzzle files", () => {
  it.each(
    GENERATED_PUZZLE_FILES.map((generated) => [generated.file, generated]),
  )("%s is up to date", async (file, { render }) => {
    expect(await render(sources, path.resolve(file))).toBe(
      readFileSync(file, "utf8"),
    );
  });
});

describe("puzzle catalog SQL", () => {
  const sql = readFileSync(PUZZLE_CATALOG_FILE, "utf8");

  it("lists every puzzle", () => {
    for (const { meta } of sources) expect(sql).toContain(`'${meta.id}'`);
  });

  it("never contains a reference fix", () => {
    for (const { meta, fix } of sources) {
      expect(sql, meta.id).not.toContain(fix.replaceAll("'", "''"));
    }
  });

  it("escapes quotes in SQL strings", () => {
    const quoted: PuzzleSource = {
      ...sources[0],
      meta: { ...sources[0].meta, title: "It's a trap" },
      buggy: "print('hi')",
    };
    const rendered = renderPuzzleCatalogSql([quoted]);
    expect(rendered).toContain("'It''s a trap'");
    expect(rendered).toContain("'print(''hi'')'");
  });

  it("retires puzzles that are no longer in puzzles/", () => {
    const rendered = renderPuzzleCatalogSql(sources.slice(0, 2));
    expect(rendered).toMatch(
      new RegExp(
        `set active = false\\s+where active\\s+and id <> all \\(array\\['${sources[0].meta.id}', '${sources[1].meta.id}'\\]\\);`,
      ),
    );
  });
});

describe("server-only fixes", () => {
  const source = readFileSync(PUZZLE_FIXES_FILE, "utf8");

  it("cannot be imported by client code", () => {
    expect(source).toMatch(/^import "server-only";$/m);
  });

  it("maps every puzzle id to its fix", async () => {
    const rendered = await renderPuzzleFixes(
      sources,
      path.resolve(PUZZLE_FIXES_FILE),
    );
    const body = rendered
      .replace('import "server-only";', "")
      .replace(/export const PUZZLE_FIXES[^=]*=/, "return");
    const fixes = new Function(body)() as Record<string, string>;
    expect(fixes).toEqual(
      Object.fromEntries(sources.map(({ meta, fix }) => [meta.id, fix])),
    );
  });
});
