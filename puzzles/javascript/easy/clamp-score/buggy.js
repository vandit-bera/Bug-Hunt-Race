// Keeps a score between `min` and `max`, both included.
function clampScore(score, min, max) {
  if (score < min) return max;
  if (score > max) return max;
  return score;
}
