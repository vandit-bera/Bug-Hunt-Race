test("counts the mines around a cell", () => {
  const board = ["*.*", "...", ".*."];
  expect(countNeighbours(board, 1, 1)).toBe(3);
  expect(countNeighbours(board, 0, 1)).toBe(2);
  expect(countNeighbours(["*."], 0, 0)).toBe(0);
});
test("cells on the last row and column are handled", () => {
  const board = ["..*", "...", "..."];
  expect(countNeighbours(board, 2, 2)).toBe(0);
  expect(countNeighbours(board, 1, 1)).toBe(1);
});
test("annotates a small board", () => {
  expect(annotate(["*.", ".."])).toEqual(["*1", "11"]);
});
test("cells with no mines around stay dots", () => {
  expect(annotate(["*..", "...", "..."])).toEqual(["*1.", "11.", "..."]);
  expect(annotate(["..", ".."])).toEqual(["..", ".."]);
});
test("wins when every safe cell is revealed", () => {
  const board = ["*.", ".."];
  expect(hasWon(board, ["0,1", "1,0", "1,1"])).toBe(true);
  expect(hasWon(board, ["0,1", "1,0"])).toBe(false);
});
test("revealing the same cell twice does not count twice", () => {
  const board = ["*.", ".."];
  expect(hasWon(board, ["0,1", "0,1", "1,0"])).toBe(false);
});
