interface User {
  name: string;
  nickname?: string;
  age?: number;
  address?: { city?: string };
}

// One-line summary for a user list: "Ada (36) from London".
// - the nickname replaces the name when it is not empty
// - a missing age shows as "unknown" (0 is a real age)
// - a missing address or city shows as "an unknown city"
function summarize(user: User): string {
  const label = user.nickname || user.name;
  const age = user.age || "unknown";
  const city = user.address.city ?? "an unknown city";
  return `${label} (${age}) from ${city}`;
}

// Summaries for a list of users, one per line, in the given order.
function summarizeAll(users: User[]): string {
  return users.map((user) => summarize(user)).join("\n");
}
