// Share of `part` in `total` as a whole-number percentage, rounded to the
// nearest integer. An empty total (0) gives 0 instead of NaN.
function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
