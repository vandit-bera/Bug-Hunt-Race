class Cart:
    """A shopping cart. Prices are whole cents.

    Each item is a dict: {"name": str, "price": int, "quantity": int}.
    A new cart never shares its items with another cart, and Cart(items)
    makes its own copy of the list it is given.
    """

    def __init__(self, items=[]):
        self.items = items

    def add(self, name, price, quantity=1):
        """Add a line to the cart."""
        self.items.append({"name": name, "price": price, "quantity": quantity})

    def count_units(self):
        """Total number of units over all lines."""
        return sum(item["quantity"] for item in self.items)

    def subtotal(self):
        """Sum of price x quantity over all lines, in cents."""
        return sum(item["price"] * item["quantity"] for item in self.items)

    def average_price(self):
        """Average price of one unit in cents, e.g. 250.5. 0 for an empty cart."""
        units = self.count_units()
        if units == 0:
            return 0
        return self.subtotal() // units

    def most_expensive(self):
        """The line with the highest total (price x quantity), or None."""
        return max(
            self.items,
            key=lambda item: item["price"],
            default=None,
        )

    def names(self):
        """Names of all lines in the order they were added."""
        return [item["name"] for item in self.items]

    def remove(self, name):
        """Remove every line called `name`. Returns how many lines were removed."""
        before = len(self.items)
        self.items = [item for item in self.items if item["name"] != name]
        return before - len(self.items)

    def is_empty(self):
        """True when the cart has no lines."""
        return not self.items
