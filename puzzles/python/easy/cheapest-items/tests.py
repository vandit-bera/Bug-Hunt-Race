def test_returns_lowest_prices_first():
    assert cheapest([30, 10, 20, 40], 2) == [10, 20]


def test_count_larger_than_list():
    assert cheapest([5, 3], 5) == [3, 5]


def test_original_list_is_unchanged():
    prices = [9, 1, 5]
    cheapest(prices, 2)
    assert prices == [9, 1, 5]


def test_zero_items():
    assert cheapest([4, 2], 0) == []
