Example: create a solution branch with small commits and AI provenance

1) Create a branch for the task

```bash
git checkout -b feat/interview-lru-solution
```

2) Make small, focused commits

Commit 1: add failing test
```
git add interview_tasks/sample_task/tests/test_lru_cache.py
git commit -m "test(lru): add failing sequence tests"
```

Commit 2: implement solution
```
git add interview_tasks/sample_task/lru_cache.py
git commit -m "feat(lru): implement LRUCache using OrderedDict"
```

Commit 3: document AI usage (if used)
```
git commit --allow-empty -m "chore: AI-assisted: prompt=\"generate LRU put/get with OrderedDict\" reviewed-by=kevin notes=verified-by-tests"
```

3) Open PR using the provided PR template (`.github/PULL_REQUEST_TEMPLATE.md`).

Notes on good provenance
- Keep the prompt short and focused.
- Summarize verification steps (tests ran, edge cases added).
- Make provenance visible in the PR body and optionally in a small commit message.
