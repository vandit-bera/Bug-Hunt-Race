test("compares by major, minor, then patch", () => {
  expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  expect(compareVersions("1.2.0", "1.10.0")).toBe(-1);
  expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
});
test("equal versions, with missing parts or a suffix", () => {
  expect(compareVersions("1.2", "1.2.0")).toBe(0);
  expect(compareVersions("1.2.3-beta", "1.2.3")).toBe(0);
});
test("sorts numbers as numbers, not as text", () => {
  expect(sortVersions(["1.10.0", "1.9.0", "1.2.0"])).toEqual([
    "1.2.0",
    "1.9.0",
    "1.10.0",
  ]);
});
test("finds the latest version", () => {
  expect(latestVersion(["1.9.0", "1.10.0", "1.2.0"])).toBe("1.10.0");
  expect(latestVersion([])).toBe(null);
});
test("isAtLeast includes the minimum itself", () => {
  expect(isAtLeast("1.4.0", "1.4.0")).toBe(true);
  expect(isAtLeast("1.3.9", "1.4.0")).toBe(false);
});
test("lists upgrades from the current version", () => {
  expect(upgradesFrom("1.9.0", ["1.10.0", "1.2.0", "1.9.0", "2.0.0"])).toEqual([
    "1.10.0",
    "2.0.0",
  ]);
});
