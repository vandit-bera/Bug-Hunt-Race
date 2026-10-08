// Leaderboard for a quiz night.
// Each entry is { name, points, time } where time is the seconds taken.
//
// Ranking rules:
//   1. more points first
//   2. on equal points, the faster time first
//   3. on equal points and time, alphabetical by name
// Entries that tie on points AND time share one rank (1, 1, 3, ...).

function compareEntries(a, b) {
  if (a.points !== b.points) return a.points - b.points;
  if (a.time !== b.time) return a.time - b.time;
  return a.name.localeCompare(b.name);
}

// Returns a sorted copy of the entries, best first.
function sortEntries(entries) {
  return entries.sort(compareEntries);
}

// Adds a `rank` to every entry of an already sorted list.
function rankEntries(sorted) {
  const ranked = [];
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const previous = ranked[i - 1];
    const tied =
      previous !== undefined &&
      previous.points === entry.points &&
      previous.time === entry.time;
    ranked.push({ ...entry, rank: tied ? previous.rank : i });
  }
  return ranked;
}

// The names of the best `n` entries, best first.
function podium(entries, n = 3) {
  return rankEntries(sortEntries(entries))
    .slice(0, n)
    .map((entry) => entry.name);
}

// One printable line per entry: "1. Ada - 90 pts (42s)".
function formatBoard(entries) {
  return rankEntries(sortEntries(entries)).map(
    (entry) =>
      `${entry.rank}. ${entry.name} - ${entry.points} pts (${entry.time}s)`,
  );
}

// Name of the entry in last place, or null for an empty board.
function lastPlace(entries) {
  const sorted = sortEntries(entries);
  return sorted.length === 0 ? null : sorted[sorted.length - 1].name;
}
