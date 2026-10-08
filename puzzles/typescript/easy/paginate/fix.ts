// Returns the items on page `page` (pages start at 1).
function paginate<T>(items: T[], page: number, perPage: number): T[] {
  if (page < 1) return [];
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
