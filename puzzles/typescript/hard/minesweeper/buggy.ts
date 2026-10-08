// Minesweeper helpers. A board is a list of strings: "*" is a mine and "."
// is an empty cell. ["*.", ".."] has one mine in the top left corner.
type Board = string[];

function inBounds(board: Board, row: number, col: number): boolean {
  return row >= 0 && row <= board.length && col >= 0 && col < board[row].length;
}

function isMine(board: Board, row: number, col: number): boolean {
  return inBounds(board, row, col) && board[row][col] === "*";
}

// Number of mines in the (up to) 8 cells around a cell, not counting the
// cell itself.
function countNeighbours(board: Board, row: number, col: number): number {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (isMine(board, row + dr, col + dc)) count += 1;
    }
  }
  return count;
}

// Replaces every empty cell with the number of mines around it, and keeps
// "." when that number is 0. Mines stay "*".
function annotate(board: Board): Board {
  return board.map((line, row) =>
    [...line]
      .map((cell, col) => {
        if (cell === "*") return "*";
        const count = countNeighbours(board, row, col);
        return count === 0 ? "." : String(count);
      })
      .join(""),
  );
}

// Total number of mines on the board.
function mineCount(board: Board): number {
  return board.join("").split("*").length - 1;
}

// The player wins when every cell without a mine has been revealed.
// `revealed` holds "row,col" strings and may list a cell more than once.
function hasWon(board: Board, revealed: string[]): boolean {
  const safeCells = board.join("").length - mineCount(board);
  return revealed.length >= safeCells;
}
