def add_tag(tag, tags=None):
    """Add `tag` to `tags` and return it.

    Without a list, start a new one.
    """
    if tags is None:
        tags = []
    tags.append(tag)
    return tags
