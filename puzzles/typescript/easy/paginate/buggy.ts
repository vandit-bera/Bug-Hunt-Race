// Returns the items on page `page` (pages start at 1).
function paginate<T>(items: T[], page: number, perPage: number): T[] {
  if (page < 1) return [];
  const start = page * perPage;
  return items.slice(start, start + perPage);
}
