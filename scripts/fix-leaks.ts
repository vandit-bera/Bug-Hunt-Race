import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface FixSource {
  id: string;
  fix: string;
}

export interface ScriptFile {
  /** Relative to the build folder, for the report. */
  file: string;
  content: string;
}

export interface FixLeak {
  id: string;
  file: string;
}

/**
 * Undoes the escapes a bundler may put in a string literal (`\n`, `\"`,
 * `\'`, `` \` ``, `\t`, `\\`), so a fix shipped in any quoting style is found.
 */
export function unescapeLiterals(source: string): string {
  return source.replace(/\\(["'`\\nt])/g, (_, char: string) =>
    char === "n" ? "\n" : char === "t" ? "\t" : char,
  );
}

/** Every reference fix found, whole, in a client script. */
export function findFixLeaks(
  fixes: readonly FixSource[],
  scripts: readonly ScriptFile[],
): FixLeak[] {
  const leaks: FixLeak[] = [];
  for (const { file, content } of scripts) {
    const decoded = unescapeLiterals(content);
    for (const { id, fix } of fixes) {
      const needle = fix.trim();
      if (content.includes(needle) || decoded.includes(needle)) {
        leaks.push({ id, file });
      }
    }
  }
  return leaks;
}

/** Every `.js` file the browser can load from a Next.js build. */
export function readClientScripts(buildDir: string): ScriptFile[] {
  const staticDir = path.join(buildDir, "static");
  return readdirSync(staticDir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({
      file: path.join("static", file),
      content: readFileSync(path.join(staticDir, file), "utf8"),
    }));
}
