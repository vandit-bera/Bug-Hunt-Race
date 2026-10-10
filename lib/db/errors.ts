/**
 * Errors from the database functions in supabase/migrations. Each function
 * raises an exception whose message is one of these codes, so the UI can show
 * a friendly message per case (e.g. "Room not found" vs "Room is locked").
 */

export const DB_ERROR_CODES = [
  "not_authenticated",
  "invalid_display_name",
  "invalid_avatar",
  "invalid_total_rounds",
  "room_not_found",
  "room_closed",
  "room_locked",
  "room_full",
  "room_settings_locked",
  "room_code_exhausted",
  "rate_limited",
  "round_not_found",
  "round_not_live",
  "not_room_admin",
  "invalid_transition",
  "no_puzzles",
  "joined_late",
  "already_submitted",
  "round_not_over",
] as const;

/**
 * `unavailable`: the request never got an answer from the database (network
 * down, Supabase down, gateway error). Safe to retry; see `toDbError`.
 * `unknown`: the database answered with an error that has no code above.
 */
export type DbErrorCode =
  (typeof DB_ERROR_CODES)[number] | "unavailable" | "unknown";

export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(
    code: DbErrorCode,
    message: string = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DbError";
    this.code = code;
  }
}

function isKnownCode(
  message: string,
): message is (typeof DB_ERROR_CODES)[number] {
  return (DB_ERROR_CODES as readonly string[]).includes(message);
}

/**
 * Wraps a Supabase/PostgREST error in a typed `DbError`. Errors from Postgres
 * and PostgREST always carry a `code` (`P0001`, `PGRST116`, …). Without one
 * the database never answered: supabase-js reports a failed fetch with an
 * empty code, and a gateway error page (502, 503, 504) has none at all. Those
 * become `unavailable`.
 */
export function toDbError(error: { message: string; code?: string }): DbError {
  if (isKnownCode(error.message)) {
    return new DbError(error.message, error.message, { cause: error });
  }
  return new DbError(error.code ? "unknown" : "unavailable", error.message, {
    cause: error,
  });
}
