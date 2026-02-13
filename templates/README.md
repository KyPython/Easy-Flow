
EasyFlow local templates

This folder contains a complete scaffold of templates and helper scripts that the EasyFlow automation agent can copy into a target repository to enforce EasyFlow standards.

Contents (high level):
- `pre-push` : Husky pre-push hook that runs fast checks (lint, tests, docs sync)
- `pre-commit` : Husky pre-commit hook to run quick local checks
- `scripts/` : idempotent helper scripts used by the agent and by CI
- `scripts/lib/error-handling.sh` : standardized logging + error helpers for shell scripts
- `observability/` : example Prometheus + Grafana snippets to copy into observability stacks
- `rockefeller/` : Rockefeller principles guidance and lightweight compliance checks
- `docs/` : `EASYFLOW-ADOPTION.md` — the adoption guide to include in target repos
- `.github/workflows/easyflow-ci.yml` : baseline CI to run lint, tests, docs and Rockefeller checks
- `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/*` : governance templates for durable quality
- `.editorconfig` : baseline editor configuration to reduce diffs and inconsistency
- `AI_PROMPT.md` : the exact automation prompt used by EasyFlow to apply standards
- `CHANGELOG-EASYFLOW-ADOPTION.md` : a changelog template recorded in the target repo

This folder is intended to be kept out of the target repository's commits when used as a local source (`templates/` is gitignored here). When applying to a target repo, the agent follows the idempotency rules described in `AI_PROMPT.md` and `docs/EASYFLOW-ADOPTION.md`.
