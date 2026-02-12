import re


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_user(data: dict) -> dict:
    """Create a user after validating `name` and `email`.

    Expected behavior: raise ValueError on invalid input. Return user dict with an `id`.
    TODO: implement.
    """
    raise NotImplementedError()
