const book: CartItem = { name: "Book", price: 1250, quantity: 1 };

test("charges shipping on a small order", () => {
  expect(cartTotals([book])).toEqual({
    subtotal: 1250,
    shipping: 499,
    total: 1749,
  });
});
test("multiplies by quantity", () => {
  expect(cartTotals([{ ...book, quantity: 3 }]).subtotal).toBe(3750);
});
test("ships free at exactly 50.00", () => {
  const cart: CartItem[] = [{ name: "Lamp", price: 5000, quantity: 1 }];
  expect(cartTotals(cart).shipping).toBe(0);
});
test("ships free above 50.00", () => {
  const cart: CartItem[] = [book, { name: "Lamp", price: 4000, quantity: 1 }];
  expect(cartTotals(cart)).toEqual({
    subtotal: 5250,
    shipping: 0,
    total: 5250,
  });
});
test("an empty cart costs nothing", () => {
  expect(cartTotals([])).toEqual({ subtotal: 0, shipping: 0, total: 0 });
});
