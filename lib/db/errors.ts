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
  "room_locked",
  "room_full",
  "room_code_exhausted",
  "round_not_found",
  "round_not_live",
  "not_room_admin",
  "invalid_transition",
] as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[number] | "unknown";

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

/** Wraps a Supabase/PostgREST error in a typed `DbError`. */
export function toDbError(error: { message: string }): DbError {
  return isKnownCode(error.message)
    ? new DbError(error.message, error.message, { cause: error })
    : new DbError("unknown", error.message, { cause: error });
}
