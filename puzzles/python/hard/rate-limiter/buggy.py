from collections import deque


class RateLimiter:
    """Allows at most `limit` calls in any window of `window` seconds.

    Time is passed in (`now`, in seconds) so the behaviour is predictable.
    A call made at time t counts while now - t < window.
    """

    def __init__(self, limit, window):
        if limit < 1 or window <= 0:
            raise ValueError("limit must be at least 1 and window above 0")
        self.limit = limit
        self.window = window
        self.calls = deque()

    def _forget_old(self, now):
        """Drop the calls that have left the window."""
        while self.calls and now - self.calls[0] > self.window:
            self.calls.popleft()

    def allow(self, now):
        """Record a call at `now` if it is allowed. Refused calls are not kept."""
        self._forget_old(now)
        self.calls.append(now)
        if len(self.calls) > self.limit:
            return False
        return True

    def remaining(self, now):
        """How many more calls would be allowed right now."""
        self._forget_old(now)
        return self.limit - len(self.calls)

    def retry_after(self, now):
        """Seconds to wait until the next call is allowed (0 if allowed now)."""
        self._forget_old(now)
        if len(self.calls) < self.limit:
            return 0
        return self.calls[0] + self.window

    def reset(self):
        """Forget every call."""
        self.calls.clear()

    def is_full(self, now):
        """True when the next call would be refused."""
        return self.remaining(now) <= 0

    def wait_text(self, now):
        """A friendly message such as "try again in 7s"."""
        seconds = self.retry_after(now)
        if seconds == 0:
            return "go ahead"
        return "try again in %ds" % seconds
