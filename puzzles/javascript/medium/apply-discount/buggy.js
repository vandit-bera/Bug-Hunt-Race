// Returns a new list; items in `category` get `percent` percent off.
// Prices are in cents and are rounded to a whole cent.
// The original items must not change.
function applyDiscount(items, category, percent) {
  return items.map((item) => {
    if (item.category !== category) return item;
    const discounted = Math.round(item.price * (1 - percent / 100));
    item.price = discounted;
    return item;
  });
}

// Total price of all items, in cents.
function totalPrice(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Formats cents as dollars, e.g. 1999 -> "$19.99".
function formatPrice(cents) {
  return "$" + (cents / 100).toFixed(2);
}
