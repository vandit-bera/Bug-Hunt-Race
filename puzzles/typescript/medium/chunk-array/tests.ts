test("splits evenly", () => {
  expect(chunk([1, 2, 3, 4], 2)).toEqual([
    [1, 2],
    [3, 4],
  ]);
});
test("keeps a shorter last group", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});
test("a list shorter than the size is one group", () => {
  expect(chunk([1], 3)).toEqual([[1]]);
});
test("an empty list has no groups", () => {
  expect(chunk([], 3)).toEqual([]);
});
test("rows match the row count", () => {
  const names = ["Ann", "Bo", "Cy", "Di", "Ed"];
  expect(toRows(names, 2)).toEqual(["Ann, Bo", "Cy, Di", "Ed"]);
  expect(toRows(names, 2).length).toBe(rowCount(names.length, 2));
});
