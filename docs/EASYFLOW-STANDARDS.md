# EasyFlow Project Standards (Extracted)

These standards are extracted from EasyFlow's repository (`.husky/pre-push`, branch-protection scripts, and docs validation scripts). Copy and paste into new projects to enforce the same rules.

## Branching & Push Rules
- Direct pushes to `main` are strictly forbidden. All changes must reach `main` via pull requests and passing CI.
- `dev` branch: pushing requires running a full local CI gate before push (unless `FAST_PUSH=true` is intentionally set).
- Feature branches (`feat/*`, `fix/*`, etc.): run light pre-push checks locally (build verification). Full CI runs on PRs and is the merge gate.
- Enforce branch protection for `main` (required status checks, PR reviews, and protected settings) — automated setup script exists (`scripts/setup-branch-protection.sh`).

## Local Pre-push Checks
- For `dev` pushes, run the project's full local CI script (e.g., `./scripts/local-ci-full.sh`) and block push on failure.
- For feature branches, verify that the frontend (or any top-level buildable subproject) builds locally before allowing push.
- Provide an explicit opt-out (`FAST_PUSH=true`) for `dev` only; document its use and risks.

## CI & PR Workflow
- All non-trivial changes must be delivered via PRs to `main` with passing CI status checks before merge.
- CI must run unit tests, linters, and any integration or observability smoke tests appropriate for the repo.
- PRs are the canonical place for full test runs; pre-push is a developer convenience / early feedback loop.

## Documentation & Release Notes
- Changes that modify APIs, docs, or user-visible behavior must update `README.md` and `docs/` as required.
- A docs-sync validation script exists and should be included in CI to fail if `docs/` or `README.md` are not updated when relevant files change (`scripts/validate-docs-sync.sh`).

## Observability & SLOs (repo conventions)
- Projects should ship with basic observability configuration and smoke tests that validate telemetry ingestion after deployment.

## Automation & Safety
- Provide scripts to configure branch protection automatically (`scripts/setup-branch-protection.sh`). Use these scripts during repository setup.
- Include pre-push hooks via Husky to prevent unsafe actions and to provide quick local verification.

## Copy-Paste Checklist (standards to enforce in every new project)
- [ ] Block direct pushes to `main` (enforce via pre-push and GitHub branch protection).
- [ ] Require PRs + passing CI for merges to `main`.
- [ ] `dev` branch must run a full local CI gate before push (allow documented opt-out `FAST_PUSH=true`).
- [ ] Feature branches must at least locally build before push.
- [ ] Provide `scripts/setup-branch-protection.sh` or equivalent for automated branch protection setup.
- [ ] Include `scripts/validate-docs-sync.sh` or CI step to ensure docs/ and README.md are updated when needed.
- [ ] Add a clear `pre-push` hook that enforces the above logic and explains the workflow to contributors.
- [ ] Add observability smoke test(s) that run after deployments and, when practical, as part of CI.
- [ ] Document exceptions (e.g., `FAST_PUSH`) and audit their usage.

---

This file was generated automatically during repository standardization; adapt as needed for project specifics.
