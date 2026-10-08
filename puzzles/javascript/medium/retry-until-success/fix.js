// Waits `ms` milliseconds.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calls `task(attempt)` until it succeeds, at most `attempts` times in total,
// waiting `delayMs` between tries. Calls `onRetry(error, attempt)` after each
// failed try that will be retried. Resolves with the first successful result,
// or rejects with the last error when every try fails.
async function retry(task, { attempts = 3, delayMs = 0, onRetry } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        if (onRetry) onRetry(error, attempt);
        await wait(delayMs);
      }
    }
  }
  throw lastError;
}
