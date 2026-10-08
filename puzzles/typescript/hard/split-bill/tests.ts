function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

test("splits evenly when it can", () => {
  expect(splitBill(900, 3)).toEqual([300, 300, 300]);
});
test("hands the leftover cents to the first people", () => {
  expect(splitBill(1000, 3)).toEqual([334, 333, 333]);
  expect(splitBill(1001, 3)).toEqual([334, 334, 333]);
});
test("the shares always add up to the total", () => {
  expect(sum(splitBill(1000, 6))).toBe(1000);
  expect(sum(splitBill(1999, 4))).toBe(1999);
  expect(largestShare(1000, 6)).toBe(167);
  expect(isFair(splitBill(1000, 6))).toBe(true);
  expect(shareOf(1000, 3, 2)).toBe(333);
});
test("rejects fewer than one person", () => {
  expect(() => splitBill(500, 0)).toThrow("at least 1");
});
test("balances show who owes and who gets money back", () => {
  expect(balances(1000, [1000, 0, 0])).toEqual([-666, 333, 333]);
  expect(isSettled(balances(1000, [1000, 0, 0]))).toBe(true);
});
test("formats a split for display", () => {
  expect(formatSplit(splitBill(1000, 3))).toBe("$3.34 + $3.33 + $3.33");
});
