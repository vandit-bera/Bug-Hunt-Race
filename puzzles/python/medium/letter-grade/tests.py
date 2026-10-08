def test_clear_grades():
    assert letter_grade(95) == "A"
    assert letter_grade(75) == "C"
    assert letter_grade(30) == "F"


def test_the_limit_itself_gets_the_higher_letter():
    assert letter_grade(90) == "A"
    assert letter_grade(60) == "D"


def test_just_below_a_limit():
    assert letter_grade(89) == "B"


def test_scores_outside_the_range_are_rejected():
    for bad in (-1, 101):
        try:
            letter_grade(bad)
        except ValueError:
            continue
        raise AssertionError("expected ValueError for %s" % bad)


def test_class_summary_counts_letters():
    assert class_summary([100, 85, 90, 40, 82]) == {"A": 2, "B": 2, "F": 1}
