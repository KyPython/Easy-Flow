def word_counts(words):
    """Naive O(n^2) implementation that counts occurrences of words.

    TODO: optimize to O(n) using a dict/Counter.
    """
    counts = []
    for w in words:
        found = False
        for pair in counts:
            if pair[0] == w:
                pair[1] += 1
                found = True
                break
        if not found:
            counts.append([w, 1])
    return dict((k, v) for k, v in counts)
