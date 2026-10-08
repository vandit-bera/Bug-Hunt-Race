// Converts a price typed by a customer into whole cents.
// Accepts an optional "$" and thousands commas: "$1,234.50" -> 123450.
// Returns null when the text is not a valid price.
function parsePriceToCents(text: string): number | null {
  const cleaned = text.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

// Adds up several typed prices, or null if any of them is invalid.
function sumPrices(texts: string[]): number | null {
  let total = 0;
  for (const text of texts) {
    const cents = parsePriceToCents(text);
    if (cents === null) return null;
    total += cents;
  }
  return total;
}

// Formats cents as dollars with two decimals: 123450 -> "$1234.50".
function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}
