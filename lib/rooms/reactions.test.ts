import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REACTION_RATE,
  REACTION_ROOM_BUDGET_PER_S,
  REACTION_SEND_MARGIN_MS,
  type ReactionMessage,
} from "@/lib/game/reactions";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/game/room-fun";
import { createReactionHub, type ReactionHub } from "./reactions";

type Shown = { sender: string; emoji: ReactionEmoji };

function hubFor(
  selfId: string,
  {
    members = ["p1", "p2", "p3"],
    online = members.length,
    send = vi.fn<(message: ReactionMessage) => boolean>(() => true),
  }: {
    members?: string[];
    online?: number;
    send?: (message: ReactionMessage) => boolean;
  } = {},
) {
  const shown: Shown[] = [];
  const hub = createReactionHub({
    selfId,
    send,
    isMember: (id) => members.includes(id),
    onlineCount: () => online,
    onShow: (sender, emojis) =>
      shown.push(...emojis.map((emoji) => ({ sender, emoji }))),
    random: () => 0,
  });
  return { hub, shown, send };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sending", () => {
  it("shows a reaction at once and sends it at once", () => {
    const { hub, shown, send } = hubFor("p1");

    expect(hub.react("🔥")).toBe(true);

    expect(shown).toEqual([{ sender: "p1", emoji: "🔥" }]);
    expect(send).toHaveBeenCalledWith({ sender: "p1", emojis: ["🔥"] });
  });

  it("allows 5 reactions per window, a little longer than receivers check", () => {
    const { hub, shown, send } = hubFor("p1");

    const results = Array.from({ length: 7 }, () => hub.react("😂"));
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(shown).toHaveLength(5);

    vi.advanceTimersByTime(REACTION_RATE.windowMs);
    expect(hub.react("😂")).toBe(false);
    vi.advanceTimersByTime(REACTION_SEND_MARGIN_MS);
    expect(hub.react("😂")).toBe(true);

    const sent = vi
      .mocked(send)
      .mock.calls.reduce(
        (total, [message]) => total + message.emojis.length,
        0,
      );
    expect(sent).toBe(6);
  });

  it("waits for room budget in a full room, then sends what piled up in one message", () => {
    const members = Array.from({ length: 30 }, (_, i) => `p${i + 1}`);
    const { hub, send } = hubFor("p1", { members });

    // One message a second is a 30-player room's whole budget.
    hub.receive({ sender: "p2", emojis: ["👏"] });
    hub.react("🔥");
    vi.advanceTimersByTime(500);
    hub.react("🐛");
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ sender: "p1", emojis: ["🔥", "🐛"] });
  });

  it("drops reactions it cannot send right now (offline)", () => {
    const send = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const { hub } = hubFor("p1", { send });

    hub.react("🔥");
    hub.react("😂");

    expect(send.mock.calls.map(([message]) => message.emojis)).toEqual([
      ["🔥"],
      ["😂"],
    ]);
  });

  it("stops sending once disposed", () => {
    const members = Array.from({ length: 30 }, (_, i) => `p${i + 1}`);
    const { hub, send } = hubFor("p1", { members });
    hub.receive({ sender: "p2", emojis: ["👏"] });
    hub.react("🔥");

    hub.dispose();
    vi.advanceTimersByTime(REACTION_RATE.windowMs * 2);

    expect(send).not.toHaveBeenCalled();
    expect(hub.react("🔥")).toBe(false);
  });
});

describe("receiving", () => {
  it("shows reactions from other room members", () => {
    const { hub, shown } = hubFor("p1");

    hub.receive({ sender: "p2", emojis: ["👏", "🔥"] });

    expect(shown).toEqual([
      { sender: "p2", emoji: "👏" },
      { sender: "p2", emoji: "🔥" },
    ]);
  });

  it.each([
    ["an invalid payload", { sender: "p2", emojis: ["💩"] }],
    ["an extra field", { sender: "p2", emojis: ["🔥"], admin: true }],
    ["a sender not in the room", { sender: "intruder", emojis: ["🔥"] }],
    ["a message claiming to be from us", { sender: "p1", emojis: ["🔥"] }],
  ])("ignores %s", (_label, payload) => {
    const { hub, shown } = hubFor("p1");
    hub.receive(payload);
    expect(shown).toEqual([]);
  });

  it("drops a spamming sender's reactions over the rate, but not others'", () => {
    const { hub, shown } = hubFor("p1");

    for (let i = 0; i < 20; i++) hub.receive({ sender: "p2", emojis: ["🐛"] });
    hub.receive({ sender: "p3", emojis: ["👏"] });

    expect(shown.filter((r) => r.sender === "p2")).toHaveLength(5);
    expect(shown.filter((r) => r.sender === "p3")).toHaveLength(1);

    vi.advanceTimersByTime(REACTION_RATE.windowMs);
    hub.receive({ sender: "p2", emojis: ["🐛"] });
    expect(shown.filter((r) => r.sender === "p2")).toHaveLength(6);
  });

  it("cuts an oversized burst down to what the rate allows", () => {
    const { hub, shown } = hubFor("p1");

    hub.receive({ sender: "p2", emojis: ["🐛", "🐛", "🐛"] });
    hub.receive({ sender: "p2", emojis: ["🔥", "🔥", "🔥"] });

    expect(shown.map((r) => r.emoji)).toEqual(["🐛", "🐛", "🐛", "🔥", "🔥"]);
  });
});

/** Clients connected through an in-memory broadcast channel. */
function createRoom(
  size: number,
  { random = () => 0 }: { random?: () => number } = {},
) {
  const ids = Array.from({ length: size }, (_, i) => `p${i + 1}`);
  const hubs = new Map<string, ReactionHub>();
  const shown = new Map<string, Shown[]>(ids.map((id) => [id, []]));
  const deliveries: number[] = [];
  for (const id of ids) {
    hubs.set(
      id,
      createReactionHub({
        selfId: id,
        send: (message) => {
          for (const [other, hub] of hubs) {
            if (other === id) continue;
            deliveries.push(Date.now());
            hub.receive(message);
          }
          return true;
        },
        isMember: (other) => ids.includes(other),
        onlineCount: () => size,
        onShow: (sender, emojis) =>
          shown.get(id)!.push(...emojis.map((emoji) => ({ sender, emoji }))),
        random,
      }),
    );
  }
  return { ids, hubs, shown, deliveries };
}

/** A small seeded generator, so the simulation is the same every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

describe("a room of clients", () => {
  it("three players see each other's reactions, and a spammer is held back", () => {
    const { hubs, shown } = createRoom(3);

    hubs.get("p1")!.react("🔥");
    hubs.get("p2")!.react("👏");
    hubs.get("p3")!.react("🐛");

    for (const [id, list] of shown) {
      expect(list.map((r) => r.sender).sort(), id).toEqual(["p1", "p2", "p3"]);
    }

    // p3 hammers the button: its own client sends only 5 per window.
    for (let i = 0; i < 30; i++) hubs.get("p3")!.react("😱");
    const fromP3 = shown.get("p1")!.filter((r) => r.sender === "p3");
    expect(fromP3).toHaveLength(5);
  });

  it("30 players spamming stay within the room's Realtime budget", () => {
    const random = seeded(42);
    const { ids, hubs, shown, deliveries } = createRoom(30, { random });
    const durationMs = 60_000;

    // Everyone taps every 200 ms (as fast as anyone can) for a minute.
    for (let t = 0; t < durationMs; t += 200) {
      for (const id of ids) {
        hubs.get(id)!.react(REACTION_EMOJIS[Math.floor(random() * 6)]!);
      }
      vi.advanceTimersByTime(200);
    }
    for (const hub of hubs.values()) hub.dispose();

    const perSecond = new Map<number, number>();
    for (const at of deliveries) {
      const second = Math.floor(at / 1000);
      perSecond.set(second, (perSecond.get(second) ?? 0) + 1);
    }
    const busiest = Math.max(...perSecond.values());
    const average = deliveries.length / (durationMs / 1000);
    expect(average).toBeLessThanOrEqual(REACTION_ROOM_BUDGET_PER_S);
    expect(busiest).toBeLessThanOrEqual(REACTION_ROOM_BUDGET_PER_S);

    // Everyone still sees a steady stream (one message a second, up to 5
    // reactions each), and every other player gets through.
    const seenByOne = shown.get("p1")!.filter((r) => r.sender !== "p1");
    expect(seenByOne.length).toBeGreaterThan((durationMs / 1000) * 4);
    expect(new Set(seenByOne.map((r) => r.sender)).size).toBe(29);
  });
});
