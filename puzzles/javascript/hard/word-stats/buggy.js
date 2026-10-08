// Word statistics for a piece of text.
// Words are made of letters and apostrophes; everything else separates them.
// Case does not matter: "The" and "the" are the same word, kept in lowercase.

function tokenize(text) {
  const matches = text.match(/[A-Za-z']+/g);
  return matches ?? [];
}

// Counts how many times each word appears, as an object word -> count.
function countWords(words) {
  const counts = {};
  for (const word of words) {
    counts[word] = (counts[word] || 0) + 1;
  }
  return counts;
}

// The `n` most common words as [word, count] pairs, most common first.
// Words with the same count are in alphabetical order.
function topWords(counts, n) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// Mean word length rounded to the nearest tenth; 0 when there are no words.
function averageLength(words) {
  if (words.length === 0) return 0;
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  return Math.floor((letters / words.length) * 10) / 10;
}

// Everything at once.
function summarize(text, n = 3) {
  const words = tokenize(text);
  const counts = countWords(words);
  return {
    total: words.length,
    unique: Object.keys(counts).length,
    top: topWords(counts, n),
    averageLength: averageLength(words),
  };
}

// The words that appear exactly once, in the order they first appear.
function singletons(text) {
  const words = tokenize(text);
  const counts = countWords(words);
  return [...new Set(words)].filter((word) => counts[word] === 1);
}
