import type { Page } from "@playwright/test";
import {
  createRoom,
  expect,
  expectLobby,
  joinByLink,
  openLobby,
  requireSupabase,
  test,
  waitForPlayers,
} from "../support";

requireSupabase();

/** Collects every request the page makes for Pyodide's files. */
function watchPyodide(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/pyodide/")) {
      seen.push(request.url());
    }
  });
  return seen;
}

// TB-19 §18 / TB-76: Python is slow to load the first time, so the lobby
// starts the download before the round does.
test("§18 Python slow to load: Pyodide is preloaded in the lobby", async ({
  players,
}) => {
  const [ana, ben] = await players(2);
  const code = await createRoom(ana.page, ana.name, { language: "python" });
  const anaPyodide = watchPyodide(ana.page);
  const benPyodide = watchPyodide(ben.page);

  await openLobby(ana.page, code);
  await joinByLink(ben.page, code, ben.name);
  await expectLobby(ben.page, code);
  await waitForPlayers(ana.page, 2);

  await expect.poll(() => anaPyodide.length).toBeGreaterThan(0);
  await expect.poll(() => benPyodide.length).toBeGreaterThan(0);
});

test("a JavaScript room's lobby does not download Pyodide", async ({
  players,
}) => {
  const [ana] = await players(1);
  const code = await createRoom(ana.page, ana.name, {
    language: "javascript",
  });
  const pyodide = watchPyodide(ana.page);

  await openLobby(ana.page, code);
  await ana.page.waitForLoadState("networkidle");
  expect(pyodide).toEqual([]);
});
