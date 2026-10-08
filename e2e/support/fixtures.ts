import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { enableNetworkControl } from "./network";

/** The game's room limit (private.max_players_per_room). */
export const MAX_PLAYERS = 30;

const NAMES = ["Ana", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana"];

export interface Player {
  /** Default display name for this player: Ana, Ben, Cleo, … */
  name: string;
  page: Page;
  context: BrowserContext;
}

export interface MultiplayerFixtures {
  /**
   * Opens `count` players, each in its own browser context: separate
   * storage, so a separate anonymous Supabase user. Their network can be cut
   * with `setOffline` / `reconnect`. Pages start blank; `createRoom` and
   * `joinRoom` open the room lab. Contexts close when the test ends.
   */
  players: (count: number) => Promise<Player[]>;
}

// The fixture callback is named `provide`, not `use`, so the React hooks lint
// rule does not mistake it for a hook.
export const test = base.extend<MultiplayerFixtures>({
  players: async ({ browser }, provide) => {
    const contexts: BrowserContext[] = [];
    await provide(async (count) => {
      if (contexts.length + count > MAX_PLAYERS) {
        throw new Error(`A room holds at most ${MAX_PLAYERS} players.`);
      }
      const opened: Player[] = [];
      for (let i = 0; i < count; i++) {
        const index = contexts.length;
        const context = await browser.newContext();
        contexts.push(context);
        await enableNetworkControl(context);
        opened.push({
          name: NAMES[index] ?? `Player ${index + 1}`,
          page: await context.newPage(),
          context,
        });
      }
      return opened;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from "@playwright/test";

/**
 * Skips the file unless a Supabase is configured. Multi-player specs need a
 * local one (`pnpm db:start`); CI runs them in the `realtime` job.
 */
export function requireSupabase() {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL,
    "needs a local Supabase (NEXT_PUBLIC_SUPABASE_URL)",
  );
}
