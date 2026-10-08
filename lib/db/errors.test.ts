import { describe, expect, it } from "vitest";
import { DB_ERROR_CODES, DbError, toDbError } from "@/lib/db";

describe("toDbError", () => {
  it.each(DB_ERROR_CODES)("keeps the known code %s", (code) => {
    const error = toDbError({ message: code });
    expect(error).toBeInstanceOf(DbError);
    expect(error.code).toBe(code);
  });

  it("marks anything else as unknown and keeps the original message", () => {
    const cause = { message: "connection reset" };
    const error = toDbError(cause);
    expect(error.code).toBe("unknown");
    expect(error.message).toBe("connection reset");
    expect(error.cause).toBe(cause);
  });
});
