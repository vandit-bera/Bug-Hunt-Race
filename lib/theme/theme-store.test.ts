import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { getStoredTheme, setStoredTheme, subscribeTheme } from "./theme-store";

type Handler = () => void;

function setup({ prefersDark = false, storageBlocked = false } = {}) {
  const storage = new Map<string, string>();
  const windowHandlers = new Map<string, Set<Handler>>();
  const mediaHandlers = new Set<Handler>();
  const media = {
    matches: prefersDark,
    addEventListener: (_: string, h: Handler) => mediaHandlers.add(h),
    removeEventListener: (_: string, h: Handler) => mediaHandlers.delete(h),
  };
  const documentElement = { dataset: {} as Record<string, string> };

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => {
        if (storageBlocked) throw new Error("blocked");
        return storage.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (storageBlocked) throw new Error("blocked");
        storage.set(key, value);
      },
    },
    matchMedia: () => media,
    addEventListener: (type: string, h: Handler) => {
      windowHandlers.set(type, (windowHandlers.get(type) ?? new Set()).add(h));
    },
    removeEventListener: (type: string, h: Handler) => {
      windowHandlers.get(type)?.delete(h);
    },
  });
  vi.stubGlobal("document", { documentElement });

  return {
    storage,
    media,
    mediaHandlers,
    windowHandlers,
    documentElement,
    fire: (handlers: Set<Handler> | undefined) => handlers?.forEach((h) => h()),
  };
}

describe("theme-store", () => {
  let env: ReturnType<typeof setup>;

  beforeEach(() => {
    env = setup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("setStoredTheme writes storage, sets data-theme and notifies", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setStoredTheme("dark");

    expect(env.storage.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(env.documentElement.dataset.theme).toBe("dark");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStoredTheme()).toBe("dark");
    unsubscribe();
  });

  it("still applies the theme when storage is blocked", () => {
    vi.unstubAllGlobals();
    env = setup({ storageBlocked: true, prefersDark: true });

    expect(() => setStoredTheme("light")).not.toThrow();
    expect(env.documentElement.dataset.theme).toBe("light");
    expect(getStoredTheme()).toBe("light");
  });

  it("re-applies System theme when the OS preference changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    setStoredTheme("system");
    expect(env.documentElement.dataset.theme).toBe("light");

    env.media.matches = true;
    env.fire(env.mediaHandlers);

    expect(env.documentElement.dataset.theme).toBe("dark");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("re-applies the stored theme on cross-tab storage events", () => {
    const unsubscribe = subscribeTheme(vi.fn());
    env.storage.set(THEME_STORAGE_KEY, "dark");

    env.fire(env.windowHandlers.get("storage"));

    expect(env.documentElement.dataset.theme).toBe("dark");
    unsubscribe();
  });

  it("notifies each listener once per external event", () => {
    const listeners = [vi.fn(), vi.fn(), vi.fn()];
    const unsubscribes = listeners.map((l) => subscribeTheme(l));

    env.fire(env.mediaHandlers);
    env.fire(env.windowHandlers.get("storage"));

    listeners.forEach((l) => expect(l).toHaveBeenCalledTimes(2));
    expect(env.mediaHandlers.size).toBe(1);
    expect(env.windowHandlers.get("storage")?.size).toBe(1);
    unsubscribes.forEach((u) => u());
  });

  it("unsubscribe removes every listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    unsubscribe();

    expect(env.windowHandlers.get("storage")?.size ?? 0).toBe(0);
    expect(env.mediaHandlers.size).toBe(0);
    setStoredTheme("dark");
    expect(listener).not.toHaveBeenCalled();
  });
});
