test("capitalises two words", () => {
  expect(titleCase("hello world")).toBe("Hello World");
});
test("capitalises a single word", () => {
  expect(titleCase("bug")).toBe("Bug");
});
test("lowercases the rest of each word", () => {
  expect(titleCase("mIxEd cAsE words")).toBe("Mixed Case Words");
});
test("keeps an empty string empty", () => {
  expect(titleCase("")).toBe("");
});
