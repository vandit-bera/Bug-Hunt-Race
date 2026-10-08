import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

/**
 * First-load JavaScript budgets, in gzipped bytes, for the pages people open
 * first. Raise one only on purpose, in the PR that needs it, and say why.
 */
export const BUNDLE_BUDGETS: readonly {
  route: string;
  maxGzipBytes: number;
}[] = [
  { route: "/", maxGzipBytes: 185 * 1024 },
  { route: "/solo", maxGzipBytes: 190 * 1024 },
];

/** The script URLs a prerendered page loads before it is interactive. */
export function scriptUrls(html: string): string[] {
  const urls = html.match(/\/_next\/static\/[^"'\s]+?\.js/g) ?? [];
  return [...new Set(urls)].sort();
}

/** `/` → `.next/server/app/index.html`, `/solo` → `.next/server/app/solo.html`. */
export function prerenderedHtmlPath(distDir: string, route: string): string {
  const name = route === "/" ? "index" : route.replace(/^\//, "");
  return path.join(distDir, "server", "app", `${name}.html`);
}

export interface RouteSize {
  route: string;
  gzipBytes: number;
  maxGzipBytes: number;
  scripts: { url: string; gzipBytes: number }[];
}

/** Measures every budgeted route of a production build in `distDir`. */
export function measureRoutes(distDir: string): RouteSize[] {
  return BUNDLE_BUDGETS.map(({ route, maxGzipBytes }) => {
    const html = readFileSync(prerenderedHtmlPath(distDir, route), "utf8");
    const scripts = scriptUrls(html).map((url) => ({
      url,
      gzipBytes: gzipSync(
        readFileSync(path.join(distDir, url.replace(/^\/_next\//, ""))),
        { level: 9 },
      ).length,
    }));
    const gzipBytes = scripts.reduce((sum, s) => sum + s.gzipBytes, 0);
    return { route, gzipBytes, maxGzipBytes, scripts };
  });
}
