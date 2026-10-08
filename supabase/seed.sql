-- DEV ONLY. Do not run on production.
--
-- Three sample puzzles (one per level) so the app has data locally. Applied
-- by `supabase db reset`. The real puzzle set and its format come from
-- puzzles/ in Phase 2 (task 7), which may replace these rows.
--
-- Tests assume a small harness from the runner: JS/TS get Jest-style
-- `test(name, fn)` and `expect(x).toBe / toEqual`; Python runs every
-- `test_*` function. Each buggy snippet fails its tests and the fix noted
-- above it passes.

insert into public.puzzles
  (id, language, level, title, buggy_code, tests, hint, time_limit_seconds, base_points)
values
  -- Fix: loop with `i < nums.length`.
  (
    'js-easy-sum-array',
    'javascript',
    'easy',
    'Sum of an array',
    $code$function sumArray(nums) {
  let total = 0;
  for (let i = 0; i <= nums.length; i++) {
    total += nums[i];
  }
  return total;
}
$code$,
    $code$test("adds positive numbers", () => {
  expect(sumArray([1, 2, 3])).toBe(6);
});

test("empty array is 0", () => {
  expect(sumArray([])).toBe(0);
});

test("handles negatives", () => {
  expect(sumArray([-1, 1, -2])).toBe(-2);
});
$code$,
    'Count how many times the loop runs for an array of 3 items.',
    180,
    100
  ),
  -- Fix: `Math.ceil(items.length / pageSize)` and `start = (page - 1) * pageSize`.
  (
    'ts-medium-paginate',
    'typescript',
    'medium',
    'Paginate a list',
    $code$interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

/** Pages are numbered from 1. */
function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.floor(items.length / pageSize);
  const start = page * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    totalPages,
  };
}
$code$,
    $code$test("first page", () => {
  expect(paginate([1, 2, 3, 4, 5], 1, 2).items).toEqual([1, 2]);
});

test("last, partial page", () => {
  expect(paginate([1, 2, 3, 4, 5], 3, 2).items).toEqual([5]);
});

test("counts a partial page", () => {
  expect(paginate([1, 2, 3, 4, 5], 1, 2).totalPages).toBe(3);
});

test("empty list has no pages", () => {
  expect(paginate([], 1, 10).totalPages).toBe(0);
});
$code$,
    'Page 1 should start at index 0. And 5 items in pages of 2 is how many pages?',
    300,
    200
  ),
  -- Fix: in get(), move the key to the end of self.order before returning;
  -- in put(), evict when `len(self.items) >= self.capacity` with
  -- `self.order.pop(0)`.
  (
    'py-hard-lru-cache',
    'python',
    'hard',
    'Least-recently-used cache',
    $code$class LRUCache:
    """Keeps at most `capacity` items, evicting the least recently used."""

    def __init__(self, capacity):
        self.capacity = capacity
        self.items = {}
        self.order = []  # oldest first

    def __len__(self):
        return len(self.items)

    def get(self, key):
        if key not in self.items:
            return None
        return self.items[key]

    def put(self, key, value):
        if key in self.items:
            self.order.remove(key)
        elif len(self.items) > self.capacity:
            oldest = self.order.pop()
            del self.items[oldest]
        self.items[key] = value
        self.order.append(key)
$code$,
    $code$def test_evicts_least_recently_used():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    assert cache.get("a") is None
    assert cache.get("b") == 2
    assert cache.get("c") == 3


def test_get_refreshes_recency():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.get("a")
    cache.put("c", 3)
    assert cache.get("a") == 1
    assert cache.get("b") is None


def test_update_does_not_evict():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("a", 10)
    assert cache.get("a") == 10
    assert cache.get("b") == 2
    assert len(cache) == 2
$code$,
    'There are three bugs: when to evict, which end of `order` is oldest, and what get() forgets to do.',
    480,
    300
  )
on conflict (id) do update
  set language = excluded.language,
      level = excluded.level,
      title = excluded.title,
      buggy_code = excluded.buggy_code,
      tests = excluded.tests,
      hint = excluded.hint,
      time_limit_seconds = excluded.time_limit_seconds,
      base_points = excluded.base_points;
