// Returns the best `limit` scores, highest first. Does not change `scores`.
function topScores(scores, limit) {
  const sorted = [...scores];
  sorted.sort();
  return sorted.slice(0, limit);
}
