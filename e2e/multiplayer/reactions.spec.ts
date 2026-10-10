import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "@/lib/db/types";
import { LIVE, expect, openRoom, requireSupabase, test } from "../support";

requireSupabase();

/** The reactions floating up on `page`. */
function floating(page: Page, emoji: string) {
  return page.getByTestId("floating-reactions").getByText(emoji);
}

/** Fails the test on any console error on `pages`. */
function watchConsole(pages: Page[]) {
  const errors: string[] = [];
  for (const page of pages) {
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
  }
  return errors;
}

/**
 * A modified client: joins the room straight through the database API, then
 * talks on the room's Realtime channel without the app's own limits.
 */
async function rogueClient(code: string) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: authError } = await client.auth.signInAnonymously();
  if (authError) throw authError;
  const { data: player, error } = await client.rpc("join_room", {
    room_code: code,
    display_name: "Rogue",
    avatar: "🐝",
  });
  if (error) throw new Error(error.message);
  const channel: RealtimeChannel = client.channel(`room:${player.room_id}`);
  await new Promise<void>((resolve, reject) =>
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") resolve();
      else if (state !== "CLOSED") reject(new Error(`Realtime: ${state}`));
    }),
  );
  return {
    id: player.id,
    send: (payload: unknown) =>
      channel.send({ type: "broadcast", event: "reaction", payload }),
    close: () => client.removeAllChannels(),
  };
}

test("three players see each other's reactions within a second", async ({
  players,
}) => {
  test.setTimeout(60_000);
  const [ana, ben, cleo] = await players(3);
  const errors = watchConsole([ana.page, ben.page, cleo.page]);
  await cleo.page.emulateMedia({ reducedMotion: "reduce" });
  await openRoom([ana, ben, cleo]);

  await ana.page.getByRole("button", { name: "Fire" }).click();
  await expect(floating(ana.page, "🔥")).toHaveCount(1);
  await expect(floating(ben.page, "🔥")).toHaveCount(1, LIVE);
  // Reduced motion: no floating emoji, a counter instead.
  await expect(cleo.page.getByTestId("reaction-counter")).toHaveText(
    "🔥 ×1",
    LIVE,
  );
  await expect(cleo.page.getByTestId("floating-reactions")).toHaveCount(0);

  await ben.page.getByRole("button", { name: "Bug" }).click();
  await expect(floating(ana.page, "🐛")).toHaveCount(1, LIVE);
  await expect(cleo.page.getByTestId("reaction-counter")).toContainText(
    "🐛 ×1",
    LIVE,
  );

  // The counter empties once the reactions are over.
  await expect(cleo.page.getByTestId("reaction-counter")).toHaveText("", {
    timeout: 5_000,
  });
  expect(errors).toEqual([]);
});

test("a spamming client is throttled and invalid reactions are ignored", async ({
  players,
}) => {
  test.setTimeout(60_000);
  const [ana, ben] = await players(2);
  const code = await openRoom([ana, ben]);
  const rogue = await rogueClient(code);
  await expect(
    ana.page.getByRole("list", { name: "Players" }).getByRole("listitem"),
  ).toHaveCount(3, LIVE);

  try {
    // Invalid: a custom emoji, an extra field, a sender not in the room.
    await rogue.send({ sender: rogue.id, emojis: ["💩"] });
    await rogue.send({ sender: rogue.id, emojis: ["😱"], name: "Admin" });
    await rogue.send({ sender: "not-a-player", emojis: ["😱"] });
    // Spam: 20 reactions at once, past its own client's limit.
    for (let i = 0; i < 20; i++) {
      await rogue.send({ sender: rogue.id, emojis: ["🚀"] });
    }

    for (const { page } of [ana, ben]) {
      await expect(floating(page, "🚀")).toHaveCount(5, LIVE);
    }
    // Give any stragglers time to arrive: still 5, and no invalid ones.
    await ana.page.waitForTimeout(1_000);
    for (const { page } of [ana, ben]) {
      await expect(floating(page, "🚀")).toHaveCount(5);
      await expect(floating(page, "💩")).toHaveCount(0);
      await expect(floating(page, "😱")).toHaveCount(0);
    }
  } finally {
    await rogue.close();
  }
});
