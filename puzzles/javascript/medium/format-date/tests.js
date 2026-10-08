test("formats a late evening UTC timestamp", () => {
  expect(formatDate("2024-03-05T23:30:00Z")).toBe("05/03/2024");
});
test("formats a date with a two digit day and month", () => {
  expect(formatDate("2023-12-25T08:00:00Z")).toBe("25/12/2023");
});
test("uses UTC, not the local time zone", () => {
  expect(formatDate("2024-01-01T00:00:00Z")).toBe("01/01/2024");
});
test("formats a timeline oldest first", () => {
  expect(
    formatTimeline(["2024-02-10T00:00:00Z", "2023-11-30T12:00:00Z"]),
  ).toEqual(["30/11/2023", "10/02/2024"]);
});
