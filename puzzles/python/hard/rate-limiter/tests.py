def test_allows_calls_up_to_the_limit():
    limiter = RateLimiter(2, 10)
    assert limiter.allow(0)
    assert limiter.allow(1)
    assert not limiter.allow(2)


def test_calls_leave_the_window_after_window_seconds():
    limiter = RateLimiter(1, 10)
    assert limiter.allow(0)
    assert not limiter.allow(9)
    assert limiter.allow(10)


def test_refused_calls_are_not_remembered():
    limiter = RateLimiter(1, 10)
    assert limiter.allow(0)
    assert not limiter.allow(5)
    assert limiter.allow(10)


def test_remaining_calls():
    limiter = RateLimiter(3, 10)
    limiter.allow(0)
    assert limiter.remaining(1) == 2


def test_retry_after_is_a_waiting_time():
    limiter = RateLimiter(2, 10)
    limiter.allow(3)
    limiter.allow(4)
    assert limiter.retry_after(6) == 7
    assert limiter.retry_after(14) == 0
