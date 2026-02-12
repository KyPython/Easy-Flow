# EasyFlow Adoption Guide

This document explains what the EasyFlow automation agent copies into a target repository and how maintainers should integrate those changes.

1) What is added
- `.husky/pre-push` — runs fast checks: lint, quick tests, docs sync
- `.husky/pre-commit` — runs quick local checks before committing
- `scripts/install-husky.sh` — helper to install husky
- `scripts/validate-docs-sync.sh` — verifies adoption docs and README
- `scripts/check-rockefeller-compliance.sh` — lightweight Rockefeller principles checker
- `scripts/lib/error-handling.sh` — standardized shell logging and error helpers
- `observability/` — example Prometheus/Grafana snippets
- `.github/workflows/easyflow-ci.yml` — baseline CI for lint, tests, docs and Rockefeller checks
- `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/*` — governance templates
- `.editorconfig` — baseline editor configuration
- `docs/EASYFLOW-ADOPTION.md` and `CHANGELOG-EASYFLOW-ADOPTION.md`

2) Installation / Upgrade steps
- The agent creates branch `chore/easyflow-standards-<YYYYMMDD>` and commits files there.
- To install hooks: run `scripts/install-husky.sh` (requires Node/npm present).
- Make sure `.husky/pre-push` is executable: `chmod +x .husky/pre-push`.

3) Idempotency and conflicts
- The agent will not overwrite files that already contain content unless the `--overwrite` flag is passed.
- When conflicts are detected the agent prints unified diffs and awaits confirmation.

4) Rockefeller principles
- See `rockefeller/README.md` for a summary of required artifacts and checks.
- Run `scripts/check-rockefeller-compliance.sh` to validate presence of the minimum artifacts.

5) Observability
- Files in `observability/` are examples. Adapt them to your monitoring stack and copy into your infra repo or observability folder.

6) Security & tokens
- Do not store secrets in templates. For GH API operations the agent expects `GITHUB_TOKEN` to be provided as an environment variable. The agent will not echo tokens.

7) Rollback
- If you do not want these changes after merging, revert the adoption branch or remove the files and update `CHANGELOG-EASYFLOW-ADOPTION.md`.
