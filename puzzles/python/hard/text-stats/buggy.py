import re


def words(text):
    """Lowercase words of `text`: letters and apostrophes only.

    Quotes around a word are not part of it: 'hello' gives hello.
    """
    found = re.findall(r"[a-z']+", text)
    return found


def word_counts(text):
    """Dictionary of word -> number of times it is used."""
    counts = {}
    for word in words(text):
        counts[word] = counts.get(word, 0) + 1
    return counts


def most_common(text, n):
    """The `n` most used words as (word, count) pairs.

    Most used first. Words used equally often are in alphabetical order.
    """
    counts = word_counts(text)
    ranked = sorted(counts.items(), key=lambda pair: -pair[1])
    return ranked[:n]


def diversity(text):
    """Share of different words, rounded to 2 places. 0 when there are no words."""
    found = words(text)
    return round(len(set(found)) / len(found), 2)


def average_length(text):
    """Average word length, rounded to 1 place. 0 when there are no words."""
    found = words(text)
    if not found:
        return 0
    return round(sum(len(word) for word in found) / len(found), 1)


def longest_word(text):
    """The longest word; the first one wins a tie. None when there are no words."""
    found = words(text)
    if not found:
        return None
    return max(found, key=len)


def unique_words(text):
    """Different words in the order they first appear."""
    return list(dict.fromkeys(words(text)))


def report(text, n=3):
    """One line per common word, such as "the: 4"."""
    return ["%s: %d" % (word, count) for word, count in most_common(text, n)]
