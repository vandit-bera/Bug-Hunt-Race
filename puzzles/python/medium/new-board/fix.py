def new_board(rows, cols):
    """A rows x cols grid filled with 0. Every cell is independent."""
    return [[0] * cols for _ in range(rows)]


def place(board, row, col, mark):
    """Put `mark` in one cell and return the board."""
    board[row][col] = mark
    return board


def count_marks(board, mark):
    """How many cells hold `mark`."""
    return sum(row.count(mark) for row in board)


def is_full(board):
    """True when no cell is still 0."""
    return all(cell != 0 for row in board for cell in row)


def rows_with(board, mark):
    """Row numbers (counting from 0) that hold `mark`."""
    return [index for index, row in enumerate(board) if mark in row]
