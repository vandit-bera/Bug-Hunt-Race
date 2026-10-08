function flaky(failures) {
  let calls = 0;
  return async (attempt) => {
    calls += 1;
    if (calls <= failures) throw new Error(`fail ${attempt}`);
    return `ok on ${attempt}`;
  };
}

async function errorFrom(promise) {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  return "no error";
}

test("resolves on the first try", async () => {
  expect(await retry(flaky(0))).toBe("ok on 1");
});
test("retries a rejected task", async () => {
  expect(await retry(flaky(2), { attempts: 3 })).toBe("ok on 3");
});
test("rejects with the last error", async () => {
  expect(await errorFrom(retry(flaky(5), { attempts: 3 }))).toBe("fail 3");
});
test("reports each retry", async () => {
  const seen = [];
  await retry(flaky(2), {
    onRetry: (error, n) => seen.push([error.message, n]),
  });
  expect(seen).toEqual([
    ["fail 1", 1],
    ["fail 2", 2],
  ]);
});
test("retries a task that throws synchronously", async () => {
  let calls = 0;
  const task = () => {
    calls += 1;
    if (calls === 1) throw new Error("sync");
    return "done";
  };
  expect(await retry(task)).toBe("done");
});
