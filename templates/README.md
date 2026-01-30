# EasyFlow Templates

This folder contains copy-pasteable templates and helper scripts to enforce EasyFlow project standards in any new repository.

Structure
- `pre-push` - Husky pre-push hook template
- `scripts/setup-branch-protection.sh` - Branch protection setup script (requires `GITHUB_REPO` and `GITHUB_TOKEN`)
- `scripts/validate-docs-sync.sh` - CI script to ensure docs updated when API/code changes
- `scripts/local-ci-full.sh` - Local CI gate template (install, lint, build, test)
- `observability/observability-smoke-test.js` - Observability smoke test template
- `AI_PROMPT.md` - Prompt for AI agents to bootstrap these templates into a new repo
- `scripts/bootstrap-easyflow-standards.sh` - Bootstrap script to copy templates into a target repo

Usage (manual)

1. Copy files from `templates/` into your new repository root.
2. If you use Husky, run `npx husky install` and copy `pre-push` into `.husky/pre-push` and `chmod +x .husky/pre-push`.
3. Add `scripts/validate-docs-sync.sh` to CI and ensure it runs on PRs.
4. Optionally run `scripts/setup-branch-protection.sh` with `GITHUB_REPO` and `GITHUB_TOKEN` to programmatically apply branch protection to `main`.

Bootstrap (automated)

Run the included bootstrap script to copy templates into a target repo and make basic setup suggestions:

```bash
./templates/scripts/bootstrap-easyflow-standards.sh /path/to/target/repo
```

The bootstrap script copies templates, makes hooks executable, and prints the next steps (install Husky, commit, push, create PR).
