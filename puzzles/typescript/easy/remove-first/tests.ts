test("removes a match in the middle", () => {
  expect(removeFirst(["a", "b", "c"], "b")).toEqual(["a", "c"]);
});
test("removes a match at the start", () => {
  expect(removeFirst(["a", "b", "c"], "a")).toEqual(["b", "c"]);
});
test("removes only the first match", () => {
  expect(removeFirst([1, 2, 1], 1)).toEqual([2, 1]);
});
test("a missing item changes nothing", () => {
  expect(removeFirst(["a", "b"], "z")).toEqual(["a", "b"]);
});
test("does not change the original list", () => {
  const items = ["a", "b"];
  removeFirst(items, "a");
  expect(items).toEqual(["a", "b"]);
});
