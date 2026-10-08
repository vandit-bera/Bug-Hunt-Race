test("a complete user", () => {
  const user: User = { name: "Ada", age: 36, address: { city: "London" } };
  expect(summarize(user)).toBe("Ada (36) from London");
});
test("a nickname replaces the name", () => {
  const user: User = {
    name: "Robert",
    nickname: "Bob",
    age: 40,
    address: { city: "Leeds" },
  };
  expect(summarize(user)).toBe("Bob (40) from Leeds");
});
test("an empty nickname is ignored", () => {
  const user: User = {
    name: "Robert",
    nickname: "",
    age: 40,
    address: { city: "Leeds" },
  };
  expect(summarize(user)).toBe("Robert (40) from Leeds");
});
test("a missing address does not crash", () => {
  expect(summarize({ name: "Cy", age: 5 })).toBe("Cy (5) from an unknown city");
  expect(summarize({ name: "Cy", age: 5, address: {} })).toBe(
    "Cy (5) from an unknown city",
  );
});
test("an age of 0 is shown, a missing age is unknown", () => {
  expect(summarize({ name: "Baby", age: 0, address: { city: "Rome" } })).toBe(
    "Baby (0) from Rome",
  );
  expect(summarize({ name: "Eve", address: { city: "Rome" } })).toBe(
    "Eve (unknown) from Rome",
  );
});
test("lists several users in order", () => {
  expect(
    summarizeAll([
      { name: "A", age: 1 },
      { name: "B", age: 2 },
    ]),
  ).toBe("A (1) from an unknown city\nB (2) from an unknown city");
});
