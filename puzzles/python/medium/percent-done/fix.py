import math


def percent_done(done, total):
    """Whole-number percentage of finished tasks.

    Halves round up: 1 of 8 is 12.5, which shows as 13.
    No tasks at all counts as 0 percent.
    """
    if total == 0:
        return 0
    return math.floor(done * 100 / total + 0.5)


def progress_label(done, total):
    """Text such as "50% done (4/8)"."""
    return "%d%% done (%d/%d)" % (percent_done(done, total), done, total)


def is_complete(done, total):
    """True when every task is done and there is at least one task."""
    return total > 0 and done >= total


def tasks_left(done, total):
    """How many tasks are still open (never below 0)."""
    return max(total - done, 0)


def is_started(done):
    """True when at least one task is done."""
    return done > 0
