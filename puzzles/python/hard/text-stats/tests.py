def test_splits_words_and_ignores_punctuation():
    assert words("Hello, world! It's 5 o'clock.") == ["hello", "world", "it's", "o'clock"]


def test_capital_letters_are_kept_as_lowercase_words():
    assert word_counts("The cat and THE hat")["the"] == 2


def test_quotes_around_a_word_are_not_part_of_it():
    assert words("He said 'hello' twice") == ["he", "said", "hello", "twice"]


def test_equal_counts_are_alphabetical():
    assert most_common("pear apple pear fig apple kiwi", 3) == [
        ("apple", 2),
        ("pear", 2),
        ("fig", 1),
    ]


def test_diversity_and_empty_text():
    assert diversity("a b a b") == 0.5
    assert diversity("") == 0
    assert diversity("1 2 3 !!!") == 0


def test_average_length_and_report():
    assert average_length("aa bbbb") == 3
    assert report("x y x", 1) == ["x: 2"]
