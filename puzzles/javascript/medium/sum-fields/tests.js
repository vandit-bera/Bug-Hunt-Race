test("adds whole numbers", () => {
  expect(sumFields(["10", "20", "5"])).toBe(35);
});
test("adds decimals", () => {
  expect(sumFields(["1.5", "2.25"])).toBe(3.75);
});
test("skips blank fields", () => {
  expect(sumFields(["4", "", "  ", "6"])).toBe(10);
});
test("rounds away floating point noise", () => {
  expect(sumFields(["0.1", "0.2"])).toBe(0.3);
});
test("averages only the filled fields", () => {
  expect(averageField(["1.5", "", "2.5"])).toBe(2);
  expect(averageField(["", " "])).toBe(0);
});
