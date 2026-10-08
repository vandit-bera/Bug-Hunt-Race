def test_merges_overlapping_intervals():
    assert merge_intervals([[1, 3], [2, 6], [8, 10]]) == [[1, 6], [8, 10]]


def test_input_order_does_not_matter():
    assert merge_intervals([[8, 10], [1, 3], [2, 6]]) == [[1, 6], [8, 10]]


def test_an_interval_inside_another_is_absorbed():
    assert merge_intervals([[1, 10], [2, 3], [4, 5]]) == [[1, 10]]


def test_touching_intervals_are_merged():
    assert merge_intervals([[1, 2], [2, 3]]) == [[1, 3]]


def test_the_input_is_not_changed():
    intervals = [[1, 3], [2, 6]]
    merge_intervals(intervals)
    assert intervals == [[1, 3], [2, 6]]


def test_free_slots_and_coverage():
    booked = [[9, 10], [10, 12], [13, 14]]
    assert free_slots(booked, 8, 17) == [[8, 9], [12, 13], [14, 17]]
    assert total_covered(booked) == 4
    assert is_free(booked, 12, 13)
