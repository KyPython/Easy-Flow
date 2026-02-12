# EasyFlow Automation Agent Prompt

Goal:
Apply EasyFlow repository standards and templates to a target Git repository. Follow idempotency, safety, and explicit confirmation rules.

Inputs (required):
- `TARGET_PATH` — absolute path to the target repo root
- `SOURCE_TEMPLATES_PATH` — absolute path to this templates folder

Behavioral rules (summarized):
- Validate `TARGET_PATH` is a git repo and clean (unless `--allow-dirty`).
- Default to `DRY_RUN=true` unless explicitly permitted to write.
- Do not overwrite non-empty target files without showing a unified diff and asking for `--overwrite` confirmation.
- Avoid echoing secrets or tokens.

Copy rules (idempotent):
- Copy `pre-push` to `.husky/pre-push` (make executable). Do not overwrite if target differs; show diff.
- Copy `scripts/*` to `scripts/` in target. For `.sh` files set `chmod +x`.
- Copy `observability/*` to `observability/` or `scripts/observability/` per target layout.
- Copy `docs/EASYFLOW-ADOPTION.md` and `CHANGELOG-EASYFLOW-ADOPTION.md` to `docs/` (ask before overwriting).

Checks & post-actions:
- Optionally run `scripts/install-husky.sh` in target if no husky detected.
- Provide `gh pr create` command if push succeeded; only create PR if `GITHUB_TOKEN` is provided and user allowed.

Output:
Return a JSON summary with `status`, `branch`, `commits`, `files_added`, `files_skipped`, `pr_url`, and `errors`.

Edge cases:
- If required template file missing, abort and list expected files.
- If `gh` or network fails, print exact commands for manual completion.

This file is intended to be used by the EasyFlow automation agent as the authoritative prompt.
# EasyFlow Automation Agent Prompt

This file contains the example prompt used by EasyFlow to scaffold standards into repositories. It is intentionally local-only and gitignored.

Example:

"Apply EasyFlow repo standards: add husky pre-push, scripts/validate-docs-sync.sh, observability hints, and docs/EASYFLOW-ADOPTION.md. Follow idempotency and safety rules."
