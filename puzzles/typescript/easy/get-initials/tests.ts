test("two names", () => {
  expect(getInitials("ada lovelace")).toBe("AL");
});
test("three names", () => {
  expect(getInitials("Grace Brewster Hopper")).toBe("GBH");
});
test("ignores extra spaces between names", () => {
  expect(getInitials("alan   turing")).toBe("AT");
});
test("ignores spaces around the name", () => {
  expect(getInitials("  linus torvalds ")).toBe("LT");
});
