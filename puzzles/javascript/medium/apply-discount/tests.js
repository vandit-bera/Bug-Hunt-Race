const catalog = [
  { name: "Novel", category: "books", price: 2000 },
  { name: "Pen", category: "office", price: 500 },
  { name: "Atlas", category: "books", price: 4000 },
];

test("discounts items in the category", () => {
  const result = applyDiscount(catalog, "books", 25);
  expect(result.map((item) => item.price)).toEqual([1500, 500, 3000]);
});
test("leaves other categories alone", () => {
  expect(applyDiscount(catalog, "toys", 50)).toEqual(catalog);
});
test("does not change the original items", () => {
  applyDiscount(catalog, "books", 25);
  expect(catalog[0].price).toBe(2000);
  expect(catalog[2].price).toBe(4000);
});
test("totals and formats the result", () => {
  const total = totalPrice(applyDiscount(catalog, "office", 10));
  expect(formatPrice(total)).toBe("$64.50");
});
