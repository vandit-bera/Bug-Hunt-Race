def cheapest(prices, count):
    """The `count` lowest prices, lowest first.

    The original list is left as it was.
    """
    ordered = sorted(prices)
    return ordered[:count]
