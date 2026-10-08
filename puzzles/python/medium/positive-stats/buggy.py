def positive_values(values):
    """The values greater than zero, in order."""
    return (value for value in values if value > 0)


def describe(values):
    """Lowest, highest and average of the positive values.

    describe([4, -1, 2, 6]) is (2, 6, 4.0).
    With no positive values it returns None.
    """
    positives = positive_values(values)
    if not positives:
        return None
    lowest = min(positives)
    highest = max(positives)
    average = sum(positives) / len(positives)
    return (lowest, highest, average)


def spread(values):
    """Highest minus lowest positive value, or 0 if there are none."""
    stats = describe(values)
    if stats is None:
        return 0
    return stats[1] - stats[0]
