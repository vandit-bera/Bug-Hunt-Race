test("averages plain ratings", () => {
  expect(averageRating([4, 5, 3])).toBe(4);
});
test("ignores unrated reviews", () => {
  expect(averageRating([5, null, 3, null])).toBe(4);
});
test("a single rating is its own average", () => {
  expect(averageRating([2])).toBe(2);
});
test("no ratings gives 0", () => {
  expect(averageRating([])).toBe(0);
  expect(averageRating([null, null])).toBe(0);
});
