def remove_negatives(numbers):
    """Remove every negative number from the list, in place.

    Returns how many numbers were removed.
    """
    removed = 0
    for number in numbers:
        if number < 0:
            numbers.remove(number)
            removed += 1
    return removed


def average_without_negatives(numbers):
    """Mean of the non-negative numbers (0 if there are none).

    The list that is passed in is not changed.
    """
    kept = list(numbers)
    remove_negatives(kept)
    return sum(kept) / len(kept) if kept else 0


def count_negatives(numbers):
    """How many numbers are below zero."""
    return sum(1 for number in numbers if number < 0)
