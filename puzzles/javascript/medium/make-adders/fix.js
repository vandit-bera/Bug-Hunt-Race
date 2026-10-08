// Builds one function per amount.
// makeAdders([1, 5]) -> [(x) => x + 1, (x) => x + 5]
function makeAdders(amounts) {
  const adders = [];
  for (let i = 0; i < amounts.length; i++) {
    adders.push((x) => x + amounts[i]);
  }
  return adders;
}

// Runs a number through every function in order.
function pipe(fns, start) {
  let value = start;
  for (const fn of fns) value = fn(value);
  return value;
}

// Adds each amount in turn: sumSteps([1, 5], 10) -> 16.
function sumSteps(amounts, start) {
  return pipe(makeAdders(amounts), start);
}
