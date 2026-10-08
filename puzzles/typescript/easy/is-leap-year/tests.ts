test("a normal leap year", () => {
  expect(isLeapYear(2024)).toBe(true);
});
test("a normal year", () => {
  expect(isLeapYear(2023)).toBe(false);
});
test("a century year divisible by 400", () => {
  expect(isLeapYear(2000)).toBe(true);
});
test("a century year not divisible by 400", () => {
  expect(isLeapYear(1900)).toBe(false);
  expect(isLeapYear(2100)).toBe(false);
});
