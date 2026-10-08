def test_whole_average():
    assert average([2, 4, 6]) == 4


def test_keeps_the_decimal_part():
    assert average([1, 2]) == 1.5


def test_single_number():
    assert average([7]) == 7


def test_empty_list_is_zero():
    assert average([]) == 0
