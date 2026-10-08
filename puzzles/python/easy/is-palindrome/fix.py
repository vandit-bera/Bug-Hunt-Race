def is_palindrome(text):
    """True if `text` reads the same backwards, ignoring case and spaces."""
    cleaned = text.replace(" ", "").lower()
    backwards = cleaned[::-1]
    return cleaned == backwards
