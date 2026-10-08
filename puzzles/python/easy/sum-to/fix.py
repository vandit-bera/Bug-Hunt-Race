def sum_to(n):
    """Add up the whole numbers from 1 to n, including n. sum_to(4) is 10."""
    total = 0
    for number in range(1, n + 1):
        total += number
    return total
