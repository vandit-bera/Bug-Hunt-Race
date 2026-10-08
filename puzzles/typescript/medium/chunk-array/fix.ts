// Splits `items` into groups of `size`. The last group may be shorter.
// chunk([1, 2, 3, 4, 5], 2) -> [[1, 2], [3, 4], [5]]
function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("size must be at least 1");
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

// Lays names out in rows for printing, e.g. 5 names in rows of 2 -> 3 rows.
function toRows(names: string[], perRow: number): string[] {
  return chunk(names, perRow).map((row) => row.join(", "));
}

// How many rows are needed for `total` items, `perRow` to a row.
function rowCount(total: number, perRow: number): number {
  return Math.ceil(total / perRow);
}
