type Progress = (done: number, total: number) => void;

// Runs `worker` over `items` in batches: the items of one batch run at the same
// time, and the next batch starts only after the previous one has finished (so
// at most `batchSize` jobs run at once). Results keep the order of `items`.
// If a worker rejects, the returned promise rejects with that error.
// `onProgress(done, total)` is called after every batch.
async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
  onProgress?: Progress,
): Promise<R[]> {
  if (batchSize < 1) throw new Error("batchSize must be at least 1");
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const done = await Promise.all(batch.map((item) => worker(item)));
    results.push(...done);
    onProgress?.(results.length, items.length);
  }
  return results;
}

type Outcome<R> = { ok: true; value: R } | { ok: false; error: string };

// Like mapInBatches, but never rejects: every item gets an outcome, in order.
// `error` is the message of the thrown Error.
async function settleInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<Outcome<R>[]> {
  return mapInBatches(items, batchSize, async (item): Promise<Outcome<R>> => {
    try {
      return { ok: true, value: await worker(item) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// How many batches mapInBatches needs for `total` items.
function batchCount(total: number, batchSize: number): number {
  return Math.ceil(total / batchSize);
}
