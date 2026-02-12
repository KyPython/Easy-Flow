**AI Usage Guidelines (for candidates & interviewers)**

Purpose
- Encourage effective, verifiable use of AI while discouraging blind copying.

Allowed uses (candidate)
- Generating test scaffolds, small helper functions, or documentation snippets.
- Searching for API examples, syntax, or quick refactoring suggestions.

Required actions (candidate)
- Verify: run tests and explain outputs for any AI-generated code before committing.
- Annotate provenance in commits/PRs with a single-line note, e.g.:

  AI-assisted: prompt="generate LRU put/get with OrderedDict", reviewed-by=candidate

- Keep commits small and explain edits in the PR body.

Interviewer probes
- Ask the candidate to walk through the worst-case behavior of AI-generated code.
- Request a short re-implementation of a small helper without AI if reasoning is unclear.

Red flags
- Large single commit that appears pasted, no tests, inability to explain core logic.

Evaluation
- Score AI Judgement separately (see rubric). Good AI use is scored positively when verified and explained.
