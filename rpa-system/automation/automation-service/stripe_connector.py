import stripe


def create_customer(api_key: str, email: str, name: str | None = None, description: str | None = None):
    """Create a Stripe customer. Returns dict with id/email/name."""
    stripe.api_key = api_key
    cust = stripe.Customer.create(email=email, name=name, description=description)
    # Return only safe subset
    return {'id': cust.get('id'), 'email': cust.get('email'), 'name': cust.get('name')}
