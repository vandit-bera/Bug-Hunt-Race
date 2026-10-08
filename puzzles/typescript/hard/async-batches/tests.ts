function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

test("keeps the order of the items", async () => {
  const delays: Record<number, number> = { 1: 15, 2: 1, 3: 8 };
  const result = await mapInBatches([1, 2, 3], 3, (n) =>
    later(n * 10, delays[n]),
  );
  expect(result).toEqual([10, 20, 30]);
});
test("every item is processed, including the last of each batch", async () => {
  const seen: number[] = [];
  await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => {
    seen.push(n);
    return n;
  });
  expect(seen).toEqual([1, 2, 3, 4, 5]);
});
test("a batch finishes before the next one starts", async () => {
  let running = 0;
  let peak = 0;
  await mapInBatches([1, 2, 3, 4, 5, 6], 3, async (n) => {
    running += 1;
    peak = Math.max(peak, running);
    await later(n, 2);
    running -= 1;
  });
  expect(peak).toBe(3);
});
test("reports progress after each batch", async () => {
  const calls: Array<[number, number]> = [];
  await mapInBatches(
    [1, 2, 3, 4, 5],
    2,
    async (n) => n,
    (done, total) => {
      calls.push([done, total]);
    },
  );
  expect(calls).toEqual([
    [2, 5],
    [4, 5],
    [5, 5],
  ]);
});
test("settleInBatches reports values and error messages", async () => {
  const outcomes = await settleInBatches([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error("two is broken");
    return n * 2;
  });
  expect(outcomes).toEqual([
    { ok: true, value: 2 },
    { ok: false, error: "two is broken" },
    { ok: true, value: 6 },
  ]);
  expect(batchCount(5, 2)).toBe(3);
});
