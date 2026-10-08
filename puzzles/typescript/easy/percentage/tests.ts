test("a half is 50 percent", () => {
  expect(percentage(1, 2)).toBe(50);
});
test("rounds to the nearest whole number", () => {
  expect(percentage(1, 3)).toBe(33);
  expect(percentage(2, 3)).toBe(67);
});
test("everything is 100 percent", () => {
  expect(percentage(8, 8)).toBe(100);
});
test("an empty total gives 0", () => {
  expect(percentage(0, 0)).toBe(0);
  expect(percentage(5, 0)).toBe(0);
});
