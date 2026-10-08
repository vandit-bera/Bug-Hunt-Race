// A small least-recently-used cache.
// `get` and `set` both count as "use"; `has` and `peek` do not.
// When the cache is full, setting a NEW key evicts the least recently used one.
// Setting a key that already exists replaces its value and never evicts.
class LruCache {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("capacity must be a positive whole number");
    }
    this.capacity = capacity;
    this.entries = new Map();
  }

  get size() {
    return this.entries.size;
  }

  has(key) {
    return this.entries.has(key);
  }

  // Reads a value without counting as use.
  peek(key) {
    return this.entries.get(key);
  }

  get(key) {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key);
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key, value) {
    this.entries.delete(key);
    if (this.entries.size >= this.capacity) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
    this.entries.set(key, value);
  }

  // Keys from least to most recently used.
  keys() {
    return [...this.entries.keys()];
  }

  clear() {
    this.entries.clear();
  }
}

// Wraps `fn` so repeated calls with the same argument reuse the cached result.
function memoize(fn, capacity) {
  const cache = new LruCache(capacity);
  return (arg) => {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
