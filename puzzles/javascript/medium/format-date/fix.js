// Formats an ISO timestamp as "DD/MM/YYYY" in UTC, e.g.
// "2024-03-05T23:30:00Z" -> "05/03/2024". UTC keeps the result the same on
// every machine, whatever its time zone.
function formatDate(iso) {
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Formats a list of ISO timestamps, oldest first. Does not change the list.
function formatTimeline(isoList) {
  return [...isoList]
    .sort((a, b) => new Date(a) - new Date(b))
    .map((iso) => formatDate(iso));
}
