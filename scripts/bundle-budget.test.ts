import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  BUNDLE_BUDGETS,
  measureRoutes,
  prerenderedHtmlPath,
  scriptUrls,
} from "./bundle-budget";

describe("scriptUrls", () => {
  it("finds each script once, sorted", () => {
    const html = `<link rel="preload" as="script" href="/_next/static/chunks/b.js"/>
<script src="/_next/static/chunks/b.js" async=""></script>
<script src="/_next/static/chunks/a-1.js" async=""></script>
<script>self.__next_f.push([1,"x"])</script>
<link rel="stylesheet" href="/_next/static/chunks/c.css"/>`;
    expect(scriptUrls(html)).toEqual([
      "/_next/static/chunks/a-1.js",
      "/_next/static/chunks/b.js",
    ]);
  });

  it("returns nothing for a page without scripts", () => {
    expect(scriptUrls("<p>hi</p>")).toEqual([]);
  });
});

describe("prerenderedHtmlPath", () => {
  it("maps routes to the prerendered HTML", () => {
    expect(prerenderedHtmlPath(".next", "/")).toBe(
      path.join(".next", "server", "app", "index.html"),
    );
    expect(prerenderedHtmlPath(".next", "/solo/play")).toBe(
      path.join(".next", "server", "app", "solo", "play.html"),
    );
  });
});

describe("measureRoutes", () => {
  it("sums the gzipped size of every script a route loads", () => {
    const dist = mkdtempSync(path.join(tmpdir(), "bundle-budget-"));
    mkdirSync(path.join(dist, "server", "app"), { recursive: true });
    mkdirSync(path.join(dist, "static", "chunks"), { recursive: true });
    const shared = "console.log('shared');".repeat(50);
    const solo = "console.log('solo');".repeat(80);
    writeFileSync(path.join(dist, "static", "chunks", "shared.js"), shared);
    writeFileSync(path.join(dist, "static", "chunks", "solo.js"), solo);
    const tag = (name: string) =>
      `<script src="/_next/static/chunks/${name}.js" async></script>`;
    for (const { route } of BUNDLE_BUDGETS) {
      const scripts =
        route === "/solo" ? tag("shared") + tag("solo") : tag("shared");
      writeFileSync(
        prerenderedHtmlPath(dist, route),
        `<html>${scripts}</html>`,
      );
    }

    const gz = (text: string) => gzipSync(text, { level: 9 }).length;
    const sizes = Object.fromEntries(
      measureRoutes(dist).map((r) => [r.route, r.gzipBytes]),
    );
    expect(sizes["/"]).toBe(gz(shared));
    expect(sizes["/solo"]).toBe(gz(shared) + gz(solo));
  });
});
