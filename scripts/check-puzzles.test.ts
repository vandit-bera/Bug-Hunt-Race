import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function check(dir: string) {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/check-puzzles.ts", "--dir", dir],
    { encoding: "utf8" },
  );
  return { code: result.status, stdout: result.stdout };
}

describe("pnpm puzzles:check", () => {
  it("exits 0 when every puzzle is fair", () => {
    const { code, stdout } = check("lib/puzzles/fixtures/valid");
    expect(stdout).toContain("✓ javascript/easy/double-it");
    expect(stdout).toContain("1 of 1 puzzles OK.");
    expect(code).toBe(0);
  });

  it("exits non-zero and names each broken puzzle", () => {
    const { code, stdout } = check("lib/puzzles/fixtures/broken");
    expect(stdout).toContain("✗ javascript/easy/buggy-passes");
    expect(stdout).toContain(
      "buggy code must fail at least one test, got 2/2 tests passed",
    );
    expect(stdout).toContain("✗ javascript/easy/fix-fails");
    expect(stdout).toContain("✗ javascript/easy/bad-meta");
    expect(stdout).toContain("0 of 4 puzzles OK, 4 failed.");
    expect(code).toBe(1);
  });

  it("exits non-zero when there are no puzzles", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "puzzles-"));
    try {
      const { code, stdout } = check(empty);
      expect(stdout).toContain("0 of 0 puzzles OK.");
      expect(code).toBe(1);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
