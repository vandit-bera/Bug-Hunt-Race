/**
 * Globals removed from the sandbox before user code runs: network, storage,
 * nested workers, messaging back to the page, and (in Node) process access.
 */
export const BLOCKED_GLOBALS = [
  "fetch",
  "fetchLater",
  "XMLHttpRequest",
  "WebSocket",
  "WebSocketStream",
  "WebTransport",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "cookieStore",
  "localStorage",
  "sessionStorage",
  "navigator",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
  "Notification",
  "postMessage",
  "process",
  "require",
] as const;

/**
 * Replaces every name in `names` on `scope` (and its prototype chain) with a
 * locked stub that throws "<name> is blocked in the sandbox". The stub is
 * non-configurable, so user code cannot delete it to reach the original. It
 * is installed even where the global never existed, so the browser and Node
 * report the same error.
 *
 * Self-contained for the same reason as `runHarness`: the Node entry point
 * ships it to a worker thread as source text.
 */
export function lockDownGlobals(scope: object, names: readonly string[]): void {
  for (const name of names) {
    for (
      let target: object | null = scope;
      target !== null;
      target = Object.getPrototypeOf(target)
    ) {
      if (Object.prototype.hasOwnProperty.call(target, name)) {
        if (!Reflect.deleteProperty(target, name)) {
          Object.defineProperty(target, name, { value: undefined });
        }
      }
    }
    const stub = () => {
      throw new Error(`${name} is blocked in the sandbox`);
    };
    Object.defineProperty(scope, name, {
      get: stub,
      configurable: false,
      enumerable: false,
    });
  }
}
