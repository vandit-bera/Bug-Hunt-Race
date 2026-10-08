def test_each_function_uses_its_own_factor():
    double, triple = make_multipliers([2, 3])
    assert double(10) == 20
    assert triple(10) == 30


def test_one_function_per_factor():
    assert len(make_multipliers([5, 6, 7])) == 3


def test_scale_all():
    assert scale_all([2, 3, 4], 10) == [20, 30, 40]


def test_shortcut_and_empty_list():
    assert double_and_triple(5) == [10, 15]
    assert scale_all([], 5) == []
