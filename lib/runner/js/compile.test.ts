import { describe, expect, it } from "vitest";
import { MAX_OUTPUT_CHARS } from "@/lib/runner/config";
import { compileSource, prepareHarnessInput } from "./compile";

describe("compileSource", () => {
  it("strips TypeScript types without type checking", () => {
    expect(
      compileSource("typescript", 'const n: number = "x" as any;', "your code"),
    ).toEqual({ ok: true, code: 'const n = "x" ;' });
  });

  it("supports TypeScript-only constructs", () => {
    const result = compileSource(
      "typescript",
      "enum Color { Red }\nclass P { constructor(private x: number) {} }",
      "your code",
    );
    expect(result.ok).toBe(true);
  });

  it("leaves modern JavaScript as is", () => {
    const source = "const v = a?.b ?? 1;\nclass A { #x = 1; static y = 2; }";
    expect(compileSource("javascript", source, "your code")).toEqual({
      ok: true,
      code: source,
    });
  });

  it("rejects type annotations in JavaScript", () => {
    expect(
      compileSource("javascript", "const n: number = 1;", "your code"),
    ).toEqual({
      ok: false,
      error: 'SyntaxError in your code: Unexpected token, expected ";" (1:8)',
    });
  });

  it("names the file that has the syntax error", () => {
    expect(compileSource("typescript", "let = ;", "the tests")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^SyntaxError in the tests: /),
    });
  });
});

describe("prepareHarnessInput", () => {
  it("compiles code and tests and sets the output cap", () => {
    expect(
      prepareHarnessInput({
        language: "typescript",
        code: "const a: number = 1;",
        tests: "const b: string = '';",
      }),
    ).toEqual({
      ok: true,
      input: {
        code: "const a = 1;",
        tests: "const b = '';",
        maxOutputChars: MAX_OUTPUT_CHARS,
      },
    });
  });

  it("refuses other languages", () => {
    expect(
      prepareHarnessInput({ language: "python", code: "", tests: "" }),
    ).toEqual({ ok: false, error: "The JS/TS runner cannot run python" });
  });
});
