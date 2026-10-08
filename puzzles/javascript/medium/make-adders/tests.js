test("each adder uses its own amount", () => {
  const [addOne, addFive] = makeAdders([1, 5]);
  expect(addOne(10)).toBe(11);
  expect(addFive(10)).toBe(15);
});
test("builds one function per amount", () => {
  expect(makeAdders([3, 4, 5]).length).toBe(3);
});
test("sumSteps applies the adders in order", () => {
  expect(sumSteps([1, 5], 10)).toBe(16);
});
test("no amounts leaves the number alone", () => {
  expect(sumSteps([], 7)).toBe(7);
});
