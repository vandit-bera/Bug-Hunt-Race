import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { createQrMatrix } from "./qr";

const SCALE = 6;
const QUIET = 4;

function decode(text: string): string | undefined {
  const matrix = createQrMatrix(text);
  const side = (matrix.size + QUIET * 2) * SCALE;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.isDark(x, y)) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = (x + QUIET) * SCALE + dx;
          const py = (y + QUIET) * SCALE + dy;
          const i = (py * side + px) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, side, side)?.data;
}

describe("createQrMatrix", () => {
  it("decodes to the exact invite link", () => {
    const link = "https://bughuntrace.example/join/K7M2QX?ref=qr&x=a%20b";
    expect(decode(link)).toBe(link);
  });

  it("decodes a short link too", () => {
    expect(decode("http://localhost:3000/join/ABC234")).toBe(
      "http://localhost:3000/join/ABC234",
    );
  });
});
