import { describe, expect, it } from "vitest";
import { BLOCKED_GLOBALS, lockDownGlobals } from "./lockdown";

function makeScope() {
  const proto = { fetch: () => "network", keep: () => "kept" };
  const scope = Object.create(proto) as Record<string, unknown>;
  scope.WebSocket = class {};
  return { proto, scope };
}

describe("lockDownGlobals", () => {
  it("replaces globals found on the scope or its prototypes", () => {
    const { proto, scope } = makeScope();
    lockDownGlobals(scope, ["fetch", "WebSocket"]);
    expect(() => scope.fetch).toThrow("fetch is blocked in the sandbox");
    expect(() => scope.WebSocket).toThrow(
      "WebSocket is blocked in the sandbox",
    );
    expect(Object.prototype.hasOwnProperty.call(proto, "fetch")).toBe(false);
    expect((scope.keep as () => string)()).toBe("kept");
  });

  it("installs a stub even when the global never existed", () => {
    const { scope } = makeScope();
    lockDownGlobals(scope, ["importScripts"]);
    expect(() => scope.importScripts).toThrow(
      "importScripts is blocked in the sandbox",
    );
  });

  it("cannot be undone by deleting or redefining the stub", () => {
    const { scope } = makeScope();
    lockDownGlobals(scope, ["fetch"]);
    expect(Reflect.deleteProperty(scope, "fetch")).toBe(false);
    expect(() =>
      Object.defineProperty(scope, "fetch", { value: () => "network" }),
    ).toThrow(TypeError);
    expect(() => scope.fetch).toThrow("fetch is blocked in the sandbox");
  });

  it("blocks network, storage and messaging APIs", () => {
    expect(BLOCKED_GLOBALS).toEqual(
      expect.arrayContaining([
        "fetch",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "importScripts",
        "indexedDB",
        "caches",
        "postMessage",
      ]),
    );
  });

  it("works when shipped as source text", () => {
    const shipped = new Function(
      `return ${lockDownGlobals.toString()}`,
    )() as typeof lockDownGlobals;
    const { scope } = makeScope();
    shipped(scope, ["fetch"]);
    expect(() => scope.fetch).toThrow("fetch is blocked in the sandbox");
  });
});
