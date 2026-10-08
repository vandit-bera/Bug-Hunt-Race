def count_words(text):
    """Number of words in `text`.

    Any amount of whitespace separates words.
    """
    words = text.split()
    return len(words)
