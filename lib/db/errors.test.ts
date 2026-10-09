import { describe, expect, it } from "vitest";
import { DB_ERROR_CODES, DbError, toDbError } from "@/lib/db";

describe("toDbError", () => {
  it.each(DB_ERROR_CODES)("keeps the known code %s", (code) => {
    const error = toDbError({ message: code });
    expect(error).toBeInstanceOf(DbError);
    expect(error.code).toBe(code);
  });

  it("marks other database errors as unknown and keeps the message", () => {
    const cause = {
      message: "permission denied for table rooms",
      code: "42501",
    };
    const error = toDbError(cause);
    expect(error.code).toBe("unknown");
    expect(error.message).toBe("permission denied for table rooms");
    expect(error.cause).toBe(cause);
  });

  it.each([
    // What supabase-js returns when fetch() itself fails (status 0).
    ["a failed fetch", { message: "TypeError: Failed to fetch", code: "" }],
    // A gateway error page instead of a PostgREST answer.
    ["a 502 page", { message: "<html><h1>502 Bad Gateway</h1></html>" }],
    [
      "a gateway JSON error",
      { message: "An invalid response was received from the upstream server" },
    ],
  ])("marks %s as unavailable", (_, cause) => {
    const error = toDbError(cause);
    expect(error.code).toBe("unavailable");
    expect(error.cause).toBe(cause);
  });
});
