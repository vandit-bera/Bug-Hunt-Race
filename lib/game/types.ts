/**
 * Shared game types. Scoring and the room state machine are implemented in
 * later tasks; see docs/ARCHITECTURE.md for the agreed design.
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
