test("parses a plain price", () => {
  expect(parsePriceToCents("12.5")).toBe(1250);
  expect(parsePriceToCents("7")).toBe(700);
});
test("converts to exact whole cents", () => {
  expect(parsePriceToCents("19.99")).toBe(1999);
  expect(parsePriceToCents("0.29")).toBe(29);
});
test("accepts a dollar sign and thousands commas", () => {
  expect(parsePriceToCents("$1,234.50")).toBe(123450);
});
test("rejects text that is not a price", () => {
  expect(parsePriceToCents("abc")).toBe(null);
  expect(parsePriceToCents("1.234")).toBe(null);
  expect(parsePriceToCents("")).toBe(null);
});
test("sums valid prices and rejects invalid ones", () => {
  expect(formatCents(sumPrices(["$1.10", "2.20"]) ?? 0)).toBe("$3.30");
  expect(sumPrices(["1.00", "oops"])).toBe(null);
});
