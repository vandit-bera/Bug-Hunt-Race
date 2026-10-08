test("keeps a score inside the range", () => {
  expect(clampScore(50, 0, 100)).toBe(50);
});
test("raises a score that is too low", () => {
  expect(clampScore(-5, 0, 100)).toBe(0);
});
test("lowers a score that is too high", () => {
  expect(clampScore(140, 0, 100)).toBe(100);
});
test("keeps the limits themselves", () => {
  expect(clampScore(0, 0, 100)).toBe(0);
  expect(clampScore(100, 0, 100)).toBe(100);
});
