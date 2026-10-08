def test_new_board_is_all_zeros():
    assert new_board(2, 3) == [[0, 0, 0], [0, 0, 0]]


def test_placing_changes_one_cell():
    board = place(new_board(3, 3), 1, 1, "X")
    assert board == [[0, 0, 0], [0, "X", 0], [0, 0, 0]]


def test_counts_marks():
    board = new_board(2, 2)
    place(board, 0, 0, "O")
    place(board, 1, 1, "O")
    assert count_marks(board, "O") == 2


def test_full_board():
    board = new_board(2, 2)
    assert not is_full(board)
    for row in range(2):
        for col in range(2):
            place(board, row, col, "X")
    assert is_full(board)
