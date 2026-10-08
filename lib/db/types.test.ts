import { describe, expectTypeOf, it } from "vitest";
import type { DbLanguage, RoomStatus } from "@/lib/db";
import type { RoomState } from "@/lib/game/types";
import type { LanguageId } from "@/lib/runner";

// Checked by `pnpm typecheck`: the database enums must match the app's types.
describe("generated database types", () => {
  it("room_status matches RoomState", () => {
    expectTypeOf<RoomStatus>().toEqualTypeOf<RoomState>();
  });

  it("language_id matches LanguageId", () => {
    expectTypeOf<DbLanguage>().toEqualTypeOf<LanguageId>();
  });
});
