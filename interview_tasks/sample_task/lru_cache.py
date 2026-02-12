from collections import OrderedDict


class LRUCache:
    """A simple LRU (least-recently-used) cache.

    Uses an OrderedDict to maintain access order. `get` and `put` are O(1).
    """

    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity must be > 0")
        self.capacity = capacity
        self._cache: OrderedDict[int, int] = OrderedDict()

    def get(self, key: int) -> int:
        """Return the value for `key` if present, else -1. Marks item as recently used."""
        if key not in self._cache:
            return -1
        value = self._cache.pop(key)
        self._cache[key] = value
        return value

    def put(self, key: int, value: int) -> None:
        """Insert or update `key` with `value`. Evict LRU item if over capacity."""
        if key in self._cache:
            # update existing key and mark as most-recently-used
            self._cache.pop(key)
            self._cache[key] = value
            return

        if len(self._cache) >= self.capacity:
            # pop the least-recently-used item (first item)
            self._cache.popitem(last=False)

        self._cache[key] = value

