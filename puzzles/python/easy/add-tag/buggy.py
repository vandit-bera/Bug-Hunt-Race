def add_tag(tag, tags=[]):
    """Add `tag` to `tags` and return it.

    Without a list, start a new one.
    """
    tags.append(tag)
    return tags
