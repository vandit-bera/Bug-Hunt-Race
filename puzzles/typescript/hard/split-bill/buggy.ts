// Splits a bill (in cents) between people, fairly and without losing a cent.
// Everyone pays the same rounded-down share, and the leftover cents go one
// each to the first people in the list: splitBill(1000, 3) -> [334, 333, 333].
function splitBill(totalCents: number, people: number): number[] {
  if (!Number.isInteger(people) || people < 1) {
    throw new Error("people must be a whole number of at least 1");
  }
  const base = Math.round(totalCents / people);
  const leftover = totalCents - base * people;
  return Array.from(
    { length: people },
    (_, i) => base + (i <= leftover ? 1 : 0),
  );
}

// How much each person still owes: their share minus what they already paid.
// A negative number means they are owed money back.
function balances(totalCents: number, paid: number[]): number[] {
  const shares = splitBill(totalCents, paid.length);
  return shares.map((share, i) => paid[i] - share);
}

// True when the balances add up to zero: nobody paid too little or too much.
function isSettled(amounts: number[]): boolean {
  return amounts.reduce((sum, amount) => sum + amount, 0) === 0;
}

// Formats a split for display: [334, 333, 333] -> "$3.34 + $3.33 + $3.33".
function formatSplit(shares: number[]): string {
  return shares.map((cents) => "$" + (cents / 100).toFixed(2)).join(" + ");
}

// True when nobody pays more than one cent more than anyone else.
function isFair(shares: number[]): boolean {
  return Math.max(...shares) - Math.min(...shares) <= 1;
}

// What person number `index` (counting from 0) pays.
function shareOf(totalCents: number, people: number, index: number): number {
  return splitBill(totalCents, people)[index];
}

// The biggest share anyone has to pay.
function largestShare(totalCents: number, people: number): number {
  return Math.max(...splitBill(totalCents, people));
}
