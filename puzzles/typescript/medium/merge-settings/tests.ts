test("no overrides gives the defaults", () => {
  expect(mergeSettings({})).toEqual({
    theme: "light",
    fontSize: 14,
    notifications: { email: true, push: false },
  });
});
test("overrides replace single values", () => {
  const settings = mergeSettings({ theme: "dark", fontSize: 18 });
  expect(describeSettings(settings)).toBe(
    "dark theme, 18px, email on, push off",
  );
});
test("a partial notification choice keeps the other default", () => {
  const settings = mergeSettings({ notifications: { push: true } });
  expect(settings.notifications).toEqual({ email: true, push: true });
});
test("the defaults are not changed by a call", () => {
  mergeSettings({ theme: "dark", notifications: { email: false } });
  expect(mergeSettings({}).theme).toBe("light");
  expect(mergeSettings({}).notifications.email).toBe(true);
});
