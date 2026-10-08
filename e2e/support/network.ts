import type { BrowserContext, Page } from "@playwright/test";

interface NetworkSwitch {
  drop(): void;
  restore(): void;
}

declare global {
  interface Window {
    __bhrNetwork?: NetworkSwitch;
  }
}

/**
 * Lets a test cut a player's Realtime connection. `context.setOffline()` alone
 * blocks new requests but may leave an open WebSocket running, so this wraps
 * `WebSocket` to close the open sockets on `drop()` and make new ones fail
 * (as they would offline) until `restore()`. Runs before any page script.
 */
function installNetworkSwitch() {
  const NativeWebSocket = window.WebSocket;
  const open = new Set<WebSocket>();
  let offline = false;

  window.WebSocket = class extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      // Port 9 (discard) refuses the connection: an error and a close
      // without an open, like a real network failure.
      super(offline ? "ws://127.0.0.1:9" : url, protocols);
      open.add(this);
      this.addEventListener("close", () => open.delete(this));
    }
  };

  window.__bhrNetwork = {
    drop() {
      offline = true;
      for (const socket of open) socket.close();
    },
    restore() {
      offline = false;
    },
  };
}

/** Called by the `players` fixture for every player's browser context. */
export async function enableNetworkControl(context: BrowserContext) {
  await context.addInitScript(installNetworkSwitch);
}

async function networkSwitch(page: Page, action: keyof NetworkSwitch) {
  const done = await page.evaluate((name) => {
    if (!window.__bhrNetwork) return false;
    window.__bhrNetwork[name]();
    return true;
  }, action);
  if (!done) {
    throw new Error(
      "Network control is missing: open the page with the `players` fixture.",
    );
  }
}

/**
 * Takes a player offline: HTTP requests fail and the Realtime connection
 * drops, so the others see them go offline (presence) at once and the
 * database marks them disconnected after 15 s without a heartbeat.
 */
export async function setOffline(page: Page) {
  // Close the sockets first, while their close frame can still reach the
  // server, so presence updates at once rather than on a server timeout.
  await networkSwitch(page, "drop");
  await page.context().setOffline(true);
}

/**
 * Brings a player back online. The Supabase client reconnects on its own
 * backoff (up to 10 s), so wait for the result with a generous timeout,
 * e.g. `RECONNECT`.
 */
export async function reconnect(page: Page) {
  await page.context().setOffline(false);
  await networkSwitch(page, "restore");
}
