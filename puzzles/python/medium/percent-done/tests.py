def test_plain_percentages():
    assert percent_done(4, 8) == 50
    assert percent_done(8, 8) == 100


def test_rounds_to_the_nearest_whole_number():
    assert percent_done(1, 3) == 33
    assert percent_done(2, 3) == 67


def test_halves_round_up():
    assert percent_done(1, 8) == 13
    assert percent_done(5, 8) == 63


def test_no_tasks_is_zero_percent():
    assert percent_done(0, 0) == 0
    assert progress_label(0, 0) == "0% done (0/0)"


def test_label_and_completion():
    assert progress_label(4, 8) == "50% done (4/8)"
    assert is_complete(3, 3)
    assert not is_complete(0, 0)
