def make_multipliers(factors):
    """One function per factor.

    make_multipliers([2, 3])[1](10) is 30.
    """
    multipliers = []
    for factor in factors:
        multipliers.append(lambda value, factor=factor: value * factor)
    return multipliers


def apply_all(functions, value):
    """The result of calling every function with `value`."""
    return [function(value) for function in functions]


def scale_all(factors, value):
    """`value` multiplied by each factor, in order."""
    return apply_all(make_multipliers(factors), value)


def double_and_triple(value):
    """Shortcut for scaling by 2 and by 3."""
    return scale_all([2, 3], value)
