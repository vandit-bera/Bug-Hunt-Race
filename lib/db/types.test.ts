import { describe, expectTypeOf, it } from "vitest";
import type { DbLanguage, RoomEvent, RoomStatus } from "@/lib/db";
import type { RoomEvent as MachineEvent } from "@/lib/game/room-machine";
import type { RoomState } from "@/lib/game/types";
import type { LanguageId } from "@/lib/runner";

// Checked by `pnpm typecheck`: the database enums must match the app's types.
describe("generated database types", () => {
  it("room_status matches RoomState", () => {
    expectTypeOf<RoomStatus>().toEqualTypeOf<RoomState>();
  });

  it("room_event matches the state machine's events", () => {
    expectTypeOf<RoomEvent>().toEqualTypeOf<MachineEvent>();
  });

  it("language_id matches LanguageId", () => {
    expectTypeOf<DbLanguage>().toEqualTypeOf<LanguageId>();
  });
});
