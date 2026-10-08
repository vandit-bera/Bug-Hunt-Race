def test_simple_palindrome():
    assert is_palindrome("level")


def test_not_a_palindrome():
    assert not is_palindrome("python")


def test_ignores_spaces():
    assert is_palindrome("nurses run")


def test_ignores_case():
    assert is_palindrome("Never odd or even")
