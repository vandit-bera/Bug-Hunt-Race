GRADES = [(90, "A"), (80, "B"), (70, "C"), (60, "D")]


def letter_grade(score):
    """Letter for a score from 0 to 100.

    90 and up is A, 80 and up is B, 70 and up is C, 60 and up is D, and
    anything lower is F. A score outside 0-100 raises ValueError.
    """
    if score < 0 or score > 100:
        raise ValueError("score must be between 0 and 100")
    for minimum, letter in GRADES:
        if score >= minimum:
            return letter
    return "F"


def class_summary(scores):
    """Count of each letter grade, e.g. {"A": 2, "C": 1}."""
    summary = {}
    for score in scores:
        letter = letter_grade(score)
        summary[letter] = summary.get(letter, 0) + 1
    return summary
