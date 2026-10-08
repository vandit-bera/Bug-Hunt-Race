test("splits words and ignores punctuation", () => {
  expect(tokenize("Hello, world! It's 5 o'clock.")).toEqual([
    "hello",
    "world",
    "it's",
    "o'clock",
  ]);
});
test("treats upper and lower case as the same word", () => {
  const counts = countWords(tokenize("The cat and THE hat"));
  expect(counts.the).toBe(2);
});
test("counts words that look like object properties", () => {
  const counts = countWords(tokenize("constructor the constructor"));
  expect(counts.constructor).toBe(2);
  expect(counts.the).toBe(1);
});
test("breaks ties alphabetically", () => {
  const top = topWords(
    countWords(tokenize("pear apple pear fig apple kiwi")),
    3,
  );
  expect(top).toEqual([
    ["apple", 2],
    ["pear", 2],
    ["fig", 1],
  ]);
});
test("rounds the average length to the nearest tenth", () => {
  expect(averageLength(["abcd", "abcde"])).toBe(4.5);
  expect(averageLength(["abc", "abc", "abc", "abcd"])).toBe(3.3);
});
test("lists the words used only once", () => {
  expect(singletons("a b a c")).toEqual(["b", "c"]);
});
