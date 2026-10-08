def test_subtotal_and_units():
    cart = Cart()
    cart.add("pen", 150, 4)
    cart.add("book", 1200)
    assert cart.subtotal() == 1800
    assert cart.count_units() == 5


def test_new_carts_start_empty():
    first = Cart()
    first.add("pen", 150)
    second = Cart()
    assert second.names() == []


def test_cart_copies_the_list_it_is_given():
    lines = [{"name": "pen", "price": 150, "quantity": 1}]
    cart = Cart(lines)
    cart.add("book", 1200)
    assert len(lines) == 1
    assert cart.names() == ["pen", "book"]


def test_average_price_keeps_the_decimals():
    cart = Cart()
    cart.add("a", 100)
    cart.add("b", 401)
    assert cart.average_price() == 250.5
    assert Cart().average_price() == 0


def test_most_expensive_looks_at_the_line_total():
    cart = Cart()
    cart.add("pen", 150, 10)
    cart.add("book", 1200, 1)
    assert cart.most_expensive()["name"] == "pen"
    assert Cart().most_expensive() is None
