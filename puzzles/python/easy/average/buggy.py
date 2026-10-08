def average(numbers):
    """Mean of a list of numbers; an empty list gives 0."""
    if not numbers:
        return 0
    total = sum(numbers)
    return total // len(numbers)
