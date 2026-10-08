import { describe, expect, it, vi } from "vitest";
import { getPreloadState, preloadRunner, subscribePreload } from "./preload";
import { IDLE_STATE, PreloadStore, READY_STATE } from "./preload-state";

describe("PreloadStore", () => {
  it("keeps the same state object until it changes", () => {
    const store = new PreloadStore();
    expect(store.getState()).toBe(IDLE_STATE);
    expect(store.getState()).toBe(store.getState());
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = new PreloadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setState({ status: "loading", progress: 0.5 });
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getState()).toEqual({ status: "loading", progress: 0.5 });
    unsubscribe();
    store.setState(READY_STATE);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("preload API", () => {
  it.each(["javascript", "typescript"] as const)(
    "%s is always ready",
    async (language) => {
      await preloadRunner(language);
      expect(getPreloadState(language)).toBe(READY_STATE);
      expect(subscribePreload(language, () => {})).toBeTypeOf("function");
    },
  );

  it("python starts idle until it is preloaded", () => {
    expect(getPreloadState("python")).toBe(IDLE_STATE);
  });
});
