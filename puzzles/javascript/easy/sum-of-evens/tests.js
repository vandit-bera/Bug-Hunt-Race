test("adds the even numbers", () => {
  expect(sumOfEvens([1, 2, 3, 4])).toBe(6);
});
test("counts the first element", () => {
  expect(sumOfEvens([2, 4, 6])).toBe(12);
});
test("handles negative numbers", () => {
  expect(sumOfEvens([-2, 3])).toBe(-2);
});
test("returns 0 for an empty array", () => {
  expect(sumOfEvens([])).toBe(0);
});
