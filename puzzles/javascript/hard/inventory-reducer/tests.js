function snapshot(state) {
  return JSON.stringify(state);
}

test("receiving adds to the stock and the log", () => {
  const state = replay([
    { type: "receive", sku: "pen", qty: 5 },
    { type: "receive", sku: "pen", qty: 3 },
  ]);
  expect(state.stock).toEqual({ pen: 8 });
  expect(state.log).toEqual(["received 5 pen", "received 3 pen"]);
});
test("receiving does not change the previous state", () => {
  const before = replay([{ type: "receive", sku: "pen", qty: 5 }]);
  const saved = snapshot(before);
  reduce(before, { type: "receive", sku: "ink", qty: 2 });
  expect(snapshot(before)).toBe(saved);
  expect(snapshot(initialState)).toBe('{"stock":{},"log":[]}');
});
test("shipping everything that is left is allowed", () => {
  const state = replay([
    { type: "receive", sku: "pen", qty: 4 },
    { type: "ship", sku: "pen", qty: 4 },
  ]);
  expect(totalUnits(state)).toBe(0);
});
test("shipping more than the stock throws", () => {
  const before = replay([{ type: "receive", sku: "pen", qty: 4 }]);
  expect(() => reduce(before, { type: "ship", sku: "pen", qty: 5 })).toThrow(
    "not enough pen",
  );
});
test("discontinuing removes the sku without touching the old state", () => {
  const before = replay([
    { type: "receive", sku: "pen", qty: 1 },
    { type: "ship", sku: "pen", qty: 1 },
  ]);
  const saved = snapshot(before);
  const after = reduce(before, { type: "discontinue", sku: "pen" });
  expect(after.stock).toEqual({});
  expect(snapshot(before)).toBe(saved);
});
test("a sku with stock cannot be discontinued", () => {
  const before = replay([{ type: "receive", sku: "pen", qty: 2 }]);
  expect(() => reduce(before, { type: "discontinue", sku: "pen" })).toThrow(
    "still has stock",
  );
});
