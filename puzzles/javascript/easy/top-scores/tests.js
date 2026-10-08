test("returns the highest scores first", () => {
  expect(topScores([5, 40, 100, 9], 3)).toEqual([100, 40, 9]);
});
test("returns everything when limit is large", () => {
  expect(topScores([3, 1, 2], 10)).toEqual([3, 2, 1]);
});
test("does not change the original array", () => {
  const scores = [5, 40, 100, 9];
  topScores(scores, 2);
  expect(scores).toEqual([5, 40, 100, 9]);
});
test("handles an empty list", () => {
  expect(topScores([], 3)).toEqual([]);
});
