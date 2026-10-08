const letters: string[] = ["a", "b", "c", "d", "e"];

test("returns the first page", () => {
  expect(paginate(letters, 1, 2)).toEqual(["a", "b"]);
});
test("returns a partial last page", () => {
  expect(paginate(letters, 3, 2)).toEqual(["e"]);
});
test("returns nothing past the end", () => {
  expect(paginate(letters, 4, 2)).toEqual([]);
});
test("returns nothing below page 1", () => {
  expect(paginate(letters, 0, 2)).toEqual([]);
});
