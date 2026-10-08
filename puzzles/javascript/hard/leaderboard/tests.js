const quiz = [
  { name: "Cy", points: 70, time: 50 },
  { name: "Ada", points: 90, time: 60 },
  { name: "Bo", points: 90, time: 45 },
  { name: "Dee", points: 70, time: 50 },
];

test("more points rank higher", () => {
  expect(sortEntries(quiz).map((entry) => entry.name)).toEqual([
    "Bo",
    "Ada",
    "Cy",
    "Dee",
  ]);
});
test("equal points are decided by the faster time", () => {
  const board = [
    { name: "Slow", points: 10, time: 90 },
    { name: "Fast", points: 10, time: 20 },
  ];
  expect(podium(board)).toEqual(["Fast", "Slow"]);
});
test("sorting does not reorder the original array", () => {
  const board = quiz.map((entry) => ({ ...entry }));
  sortEntries(board);
  expect(board.map((entry) => entry.name)).toEqual(["Cy", "Ada", "Bo", "Dee"]);
});
test("ranks start at 1 and ties share a rank", () => {
  expect(formatBoard(quiz)).toEqual([
    "1. Bo - 90 pts (45s)",
    "2. Ada - 90 pts (60s)",
    "3. Cy - 70 pts (50s)",
    "3. Dee - 70 pts (50s)",
  ]);
});
test("the rank after a tie skips ahead", () => {
  const board = [
    { name: "A", points: 5, time: 1 },
    { name: "B", points: 5, time: 1 },
    { name: "C", points: 3, time: 1 },
  ];
  expect(rankEntries(sortEntries(board)).map((entry) => entry.rank)).toEqual([
    1, 1, 3,
  ]);
});
test("finds the last place", () => {
  expect(lastPlace(quiz)).toBe("Dee");
  expect(lastPlace([])).toBe(null);
});
