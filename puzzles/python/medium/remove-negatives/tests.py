def test_removes_a_negative():
    numbers = [3, -1, 4]
    assert remove_negatives(numbers) == 1
    assert numbers == [3, 4]


def test_removes_neighbouring_negatives():
    numbers = [-1, -2, -3, 5]
    assert remove_negatives(numbers) == 3
    assert numbers == [5]


def test_nothing_to_remove():
    numbers = [1, 2]
    assert remove_negatives(numbers) == 0
    assert numbers == [1, 2]


def test_average_ignores_negatives_and_keeps_the_input():
    numbers = [2, -5, 4, -1]
    assert average_without_negatives(numbers) == 3
    assert numbers == [2, -5, 4, -1]
    assert count_negatives(numbers) == 2
