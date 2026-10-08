def test_adds_months_within_a_year():
    assert add_months(date(2024, 3, 15), 2) == date(2024, 5, 15)


def test_wraps_over_the_new_year():
    assert add_months(date(2024, 11, 10), 3) == date(2025, 2, 10)
    assert add_months(date(2024, 12, 5), 1) == date(2025, 1, 5)


def test_goes_back_in_time():
    assert add_months(date(2024, 1, 20), -2) == date(2023, 11, 20)


def test_short_months_use_their_last_day():
    assert add_months(date(2023, 1, 31), 1) == date(2023, 2, 28)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)


def test_billing_dates_are_counted_from_the_start():
    assert billing_dates(date(2023, 1, 31), 4) == [
        date(2023, 1, 31),
        date(2023, 2, 28),
        date(2023, 3, 31),
        date(2023, 4, 30),
    ]


def test_age_waits_for_the_birthday():
    born = date(2000, 6, 15)
    assert age_in_years(born, date(2024, 6, 14)) == 23
    assert age_in_years(born, date(2024, 6, 15)) == 24
