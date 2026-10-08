interface CartItem {
  name: string;
  /** Price of one unit, in cents. */
  price: number;
  quantity: number;
}

interface Totals {
  subtotal: number;
  shipping: number;
  total: number;
}

const SHIPPING_CENTS = 499;
const FREE_SHIPPING_FROM_CENTS = 5000;

// Works out the cart totals in cents. Shipping is free when the subtotal is
// 50.00 or more. An empty cart costs nothing, not even shipping.
function cartTotals(items: CartItem[]): Totals {
  if (items.length === 0) {
    return { subtotal: 0, shipping: 0, total: 0 };
  }
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shipping = subtotal >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_CENTS;
  return { subtotal, shipping, total: subtotal + shipping };
}
