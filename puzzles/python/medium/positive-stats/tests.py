def test_positive_values_keeps_order():
    assert list(positive_values([3, -2, 0, 7])) == [3, 7]


def test_describe_mixed_values():
    assert describe([4, -1, 2, 6]) == (2, 6, 4.0)


def test_describe_single_value():
    assert describe([5]) == (5, 5, 5.0)


def test_no_positive_values():
    assert describe([-1, 0]) is None
    assert describe([]) is None


def test_spread():
    assert spread([4, -1, 2, 6]) == 4
    assert spread([-3]) == 0
