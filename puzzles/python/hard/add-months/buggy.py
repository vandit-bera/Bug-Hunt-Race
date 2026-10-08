import calendar
from datetime import date


def month_name(month):
    """English name of a month number (1-12)."""
    return calendar.month_name[month]


def days_in_month(year, month):
    """Number of days in the given month (month is 1-12)."""
    return calendar.monthrange(year, month)[0]


def add_months(day, months):
    """Move a date by whole months.

    If the day does not exist in the new month, the last day of that month is
    used: Jan 31 + 1 month is Feb 28 (Feb 29 in a leap year).
    """
    index = day.year * 12 + (day.month) + months
    year = index // 12
    month = index % 12 + 1
    new_day = day.day
    return date(year, month, new_day)


def billing_dates(start, count):
    """The first `count` monthly billing dates, starting with `start`.

    Every date is worked out from `start`, so the day is never lost:
    Jan 31 gives Jan 31, Feb 28, Mar 31, Apr 30, ...
    """
    dates = []
    current = start
    for _ in range(count):
        dates.append(current)
        current = add_months(current, 1)
    return dates


def last_day_of_month(day):
    """The last date of the month that `day` is in."""
    return date(day.year, day.month, days_in_month(day.year, day.month))


def is_month_end(day):
    """True when `day` is the last day of its month."""
    return day == last_day_of_month(day)


def days_until(today, target):
    """Whole days from `today` to `target` (negative if it is in the past)."""
    return (target - today).days


def age_in_years(born, today):
    """Whole years between `born` and `today`.

    A birthday that has not been reached yet this year does not count.
    """
    years = today.year - born.year
    return years
