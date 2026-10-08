def test_small_sum():
    assert sum_to(4) == 10


def test_one():
    assert sum_to(1) == 1


def test_ten():
    assert sum_to(10) == 55


def test_zero_is_zero():
    assert sum_to(0) == 0
