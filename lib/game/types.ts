/**
 * Shared game types. Scoring is in `scoring.ts`, the room state machine in
 * `room-machine.ts`; see docs/ARCHITECTURE.md.
 */

export type Level = "easy" | "medium" | "hard" | "mixed";

export type RoomState =
  | "lobby"
  | "countdown"
  | "round_live"
  | "paused"
  | "round_results"
  | "final_leaderboard"
  | "closed";
