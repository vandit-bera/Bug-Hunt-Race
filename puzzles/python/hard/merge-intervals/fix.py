def merge_intervals(intervals):
    """Merge overlapping or touching [start, end] intervals.

    merge_intervals([[1, 3], [2, 6], [8, 10], [6, 7]]) -> [[1, 7], [8, 10]]
    The input list and the intervals inside it must not change.
    """
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged = [list(ordered[0])]
    for start, end in ordered[1:]:
        last = merged[-1]
        if start <= last[1]:
            last[1] = max(last[1], end)
        else:
            merged.append([start, end])
    return merged


def total_covered(intervals):
    """Total length covered by the intervals (overlaps count once)."""
    return sum(end - start for start, end in merge_intervals(intervals))


def is_free(intervals, start, end):
    """True when [start, end] does not overlap any interval.

    Touching an interval at one end is fine.
    """
    return all(end <= s or start >= e for s, e in merge_intervals(intervals))


def overlaps(a, b):
    """True when two [start, end] intervals share more than a single point."""
    return a[0] < b[1] and b[0] < a[1]


def free_slots(intervals, day_start, day_end):
    """Gaps inside [day_start, day_end] that no interval covers."""
    free = []
    cursor = day_start
    for start, end in merge_intervals(intervals):
        if start > cursor:
            free.append([cursor, start])
        cursor = max(cursor, end)
    if cursor < day_end:
        free.append([cursor, day_end])
    return free


def longest_free_slot(intervals, day_start, day_end):
    """The longest gap from free_slots, or None when the day is full."""
    slots = free_slots(intervals, day_start, day_end)
    return max(slots, key=lambda slot: slot[1] - slot[0], default=None)
