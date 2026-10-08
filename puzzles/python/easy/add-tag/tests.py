def test_adds_to_a_given_list():
    assert add_tag("b", ["a"]) == ["a", "b"]


def test_returns_the_same_list():
    tags = ["a"]
    assert add_tag("b", tags) is tags


def test_first_call_without_a_list():
    assert add_tag("x") == ["x"]


def test_separate_calls_do_not_share_tags():
    add_tag("first")
    assert add_tag("second") == ["second"]
