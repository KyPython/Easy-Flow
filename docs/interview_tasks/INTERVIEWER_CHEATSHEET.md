**Interviewer Cheat-sheet (quick reference)**

Before the session
- Ensure candidate has repo access and a working test command (`pytest -q`).
- Confirm timebox and allowed tools (note AI rules in `docs/AI_USAGE_GUIDELINES.md`).

During the session (60-minute flow)
- 0–10m: let candidate read repo and run tests; note whether they run tests immediately.
- 10–45m: observe commits (encourage small commits); ask clarifying questions.
- 45–60m: candidate explains approach, tradeoffs, and next steps.

Key questions to probe reasoning
- Why this data structure? Why not alternative X?
- What are the complexity and memory tradeoffs?
- How would you roll this out in production? (migrations, backwards compatibility)
- If you used AI for this change, show the prompt and explain how you verified it.

Red flags checklist
- No tests added for behavior changes.
- One huge commit that doesn't separate concerns.
- Candidate cannot explain code they submitted.

Scoring quick-reference
- 4–5: small commits, tests present, clear rationale, verified AI use (if any).
- 2–3: partial solution, missing tests, or unclear tradeoff reasoning.
- 1: incorrect solution, no verification, or cannot explain.

Post-interview notes
- Save branch/PR for later review; include the candidate’s explanation and any prompts used.
