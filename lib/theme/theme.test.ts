import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getThemeInitScript,
  parseTheme,
  resolveTheme,
} from "./theme";

describe("parseTheme", () => {
  it("accepts the three valid themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for missing or invalid values", () => {
    expect(DEFAULT_THEME).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("neon")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("returns explicit choices unchanged", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS preference for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("getThemeInitScript", () => {
  function run(stored: string | null, prefersDark: boolean) {
    const documentElement = { dataset: {} as Record<string, string> };
    const sandbox = {
      localStorage: {
        getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
      },
      matchMedia: () => ({ matches: prefersDark }),
    };
    new Function("localStorage", "window", "document", getThemeInitScript())(
      sandbox.localStorage,
      sandbox,
      { documentElement },
    );
    return documentElement.dataset.theme;
  }

  it("applies the stored explicit theme", () => {
    expect(run("dark", false)).toBe("dark");
    expect(run("light", true)).toBe("light");
  });

  it("uses the OS preference for system, missing or invalid values", () => {
    expect(run("system", true)).toBe("dark");
    expect(run(null, false)).toBe("light");
    expect(run("bogus", true)).toBe("dark");
  });

  it("does not throw when storage is unavailable", () => {
    const documentElement = { dataset: {} as Record<string, string> };
    const broken = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
      matchMedia: () => ({ matches: true }),
    };
    expect(() =>
      new Function("localStorage", "window", "document", getThemeInitScript())(
        broken.localStorage,
        broken,
        { documentElement },
      ),
    ).not.toThrow();
  });
});
