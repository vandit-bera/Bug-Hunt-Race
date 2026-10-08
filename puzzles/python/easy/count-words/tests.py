def test_counts_simple_words():
    assert count_words("hello brave new world") == 4


def test_extra_spaces_do_not_add_words():
    assert count_words("hello    world") == 2


def test_spaces_around_the_text():
    assert count_words("  padded text  ") == 2


def test_empty_text_has_no_words():
    assert count_words("") == 0
    assert count_words("   ") == 0
