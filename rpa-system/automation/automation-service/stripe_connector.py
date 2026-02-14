import stripe


def _set_key(api_key: str):
    stripe.api_key = api_key


def create_customer(api_key: str, email: str, name: str | None = None, description: str | None = None):
    """Create a Stripe customer. Returns dict with id/email/name."""
    _set_key(api_key)
    cust = stripe.Customer.create(email=email, name=name, description=description)
    return {'id': cust.get('id'), 'email': cust.get('email'), 'name': cust.get('name')}


def create_product(api_key: str, name: str, description: str | None = None):
    """Create a Stripe product. Returns dict with id/name."""
    _set_key(api_key)
    prod = stripe.Product.create(name=name, description=description)
    return {'id': prod.get('id'), 'name': prod.get('name')}


def create_price(api_key: str, product_id: str, unit_amount: int, currency: str = 'usd', recurring_interval: str | None = None):
    """Create a Stripe price. Use recurring_interval ('day'|'week'|'month'|'year') for subscriptions.
    Returns dict with id/product/amount/currency/recurring.
    """
    _set_key(api_key)
    params = {
        'product': product_id,
        'unit_amount': unit_amount,
        'currency': currency
    }
    if recurring_interval:
        params['recurring'] = {'interval': recurring_interval}
    price = stripe.Price.create(**params)
    return {
        'id': price.get('id'),
        'product': product_id,
        'unit_amount': unit_amount,
        'currency': currency,
        'recurring': bool(recurring_interval)
    }


def create_payment_link(api_key: str, price_id: str, quantity: int = 1):
    """Create a Payment Link for a given price. Returns dict with id/url."""
    _set_key(api_key)
    pl = stripe.PaymentLink.create(line_items=[{'price': price_id, 'quantity': quantity}])
    return {'id': pl.get('id'), 'url': pl.get('url')}


def create_checkout_session(api_key: str, price_id: str, quantity: int = 1, mode: str = 'payment', success_url: str = 'https://example.com/success', cancel_url: str = 'https://example.com/cancel'):
    """Create a Checkout Session. Returns dict with id/url."""
    _set_key(api_key)
    session = stripe.checkout.Session.create(
        line_items=[{'price': price_id, 'quantity': quantity}],
        mode=mode,
        success_url=success_url,
        cancel_url=cancel_url
    )
    return {'id': session.get('id'), 'url': session.get('url')}
