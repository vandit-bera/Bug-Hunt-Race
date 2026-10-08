import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUTE_STORAGE_KEY } from "./sound-store";

type Handler = () => void;

async function setup({ storageBlocked = false } = {}) {
  vi.resetModules();
  const storage = new Map<string, string>();
  const handlers = new Map<string, Set<Handler>>();
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
    addEventListener: (type: string, h: Handler) => {
      handlers.set(type, (handlers.get(type) ?? new Set()).add(h));
    },
    removeEventListener: (type: string, h: Handler) => {
      handlers.get(type)?.delete(h);
    },
  });
  const store = await import("./sound-store");
  return {
    store,
    storage,
    fire: (type: string) => handlers.get(type)?.forEach((h) => h()),
  };
}

describe("sound store", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("is silent until the first interaction, then audible", async () => {
    const { store, fire } = await setup();
    expect(store.canPlaySound()).toBe(false);
    fire("pointerdown");
    expect(store.canPlaySound()).toBe(true);
  });

  it("also unlocks on a key press", async () => {
    const { store, fire } = await setup();
    store.armSound();
    fire("keydown");
    expect(store.canPlaySound()).toBe(true);
  });

  it("stays silent after the interaction when muted", async () => {
    const { store, fire } = await setup();
    store.armSound();
    store.setMuted(true);
    fire("pointerdown");
    expect(store.canPlaySound()).toBe(false);
    store.setMuted(false);
    expect(store.canPlaySound()).toBe(true);
  });

  it("saves the mute choice in localStorage", async () => {
    const { store, storage } = await setup();
    expect(store.getMuted()).toBe(false);
    store.setMuted(true);
    expect(storage.get(MUTE_STORAGE_KEY)).toBe("1");
    expect(store.getMuted()).toBe(true);
  });

  it("keeps the choice for the visit when storage is blocked", async () => {
    const { store } = await setup({ storageBlocked: true });
    store.setMuted(true);
    expect(store.getMuted()).toBe(true);
  });

  it("tells subscribers when the choice changes", async () => {
    const { store } = await setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribeMuted(listener);
    store.setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setMuted(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
