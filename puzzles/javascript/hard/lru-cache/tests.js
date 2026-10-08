function filled() {
  const cache = new LruCache(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  return cache;
}

test("stores and reads values", () => {
  const cache = filled();
  expect(cache.get("b")).toBe(2);
  expect(cache.get("zzz")).toBe(undefined);
  expect(cache.size).toBe(3);
});
test("evicts the oldest key when a new key does not fit", () => {
  const cache = filled();
  cache.set("d", 4);
  expect(cache.keys()).toEqual(["b", "c", "d"]);
  expect(cache.size).toBe(3);
});
test("reading a key makes it the most recently used", () => {
  const cache = filled();
  cache.get("a");
  cache.set("d", 4);
  expect(cache.keys()).toEqual(["c", "a", "d"]);
});
test("setting an existing key never evicts and moves it to the back", () => {
  const cache = filled();
  cache.set("b", 20);
  expect(cache.keys()).toEqual(["a", "c", "b"]);
  expect(cache.peek("b")).toBe(20);
});
test("peek and has do not count as use", () => {
  const cache = filled();
  cache.peek("a");
  cache.has("a");
  expect(cache.keys()).toEqual(["a", "b", "c"]);
});
test("memoize computes each argument once", () => {
  let calls = 0;
  const square = memoize((n) => {
    calls += 1;
    return n * n;
  }, 2);
  expect(square(3)).toBe(9);
  expect(square(3)).toBe(9);
  expect(calls).toBe(1);
});
