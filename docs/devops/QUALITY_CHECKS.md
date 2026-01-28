# Documentation/Code Sync Check

### What it does
Ensures that documentation (README.md, docs/, and all .md files) is updated whenever code, scripts, or APIs change. Fails if code changes are made without corresponding documentation updates, or if TODOs/outdated references are found in docs.

### How to run
Run manually:

```bash
bash scripts/validate-docs-sync.sh
```

Or see the automated workflow: `.github/workflows/docs-sync.yml`

### How to fix failures
- If you change code, update the relevant documentation (README.md, docs/, or related .md files).
- Remove or resolve any TODO, FIXME, or outdated references in documentation.

---
# CI/CD Quality & Best Practices Checks
# CI/CD Workflow Validation

### What it does
Checks all GitHub Actions workflows in `.github/workflows/` for:
- Duplicate workflow file names
- Duplicate job or step names
- SRP violations (workflows with too many unrelated jobs or steps)
- Unused or redundant workflows
- Redundant triggers

### How to run
Run manually:

```bash
bash scripts/validate-cicd-workflows.sh
```

Or see the automated workflow: `.github/workflows/cicd-workflow-validation.yml`

### How to fix failures
- Rename duplicate jobs/steps
- Split workflows that violate SRP
- Remove or merge redundant workflows
- Remove unused workflows

---

# Shell Script Consolidation

### Rationale
Several scripts previously overlapped (e.g., duplicate detection for code, features, and CI/CD). These have been consolidated for clarity and maintainability, while still following the single responsibility principle (SRP):

- `validate-cicd-workflows.sh` now covers all CI/CD workflow checks (duplicates, SRP, redundancy)
- `validate-duplicate-code.sh` covers code duplication
- `validate-duplicate-features.sh` covers feature duplication

All entrypoints and test scripts have been updated to use the new consolidated scripts.

---

# See Also
- Main README for pointers to all validation and quality checks
This project enforces code quality, complexity, and web best practices via automated CI/CD checks. All checks are documented here for developer reference.

## Sovereign Complexity Analysis
- **Script:** `scripts/complexity_analysis.py`
- **Workflow:** `.github/workflows/complexity-analysis.yml`
- **Purpose:** Detects deeply nested loops (time complexity proxies) and large allocations inside loops (space complexity proxies) in Python code.
- **How to fix:** Refactor code to reduce loop nesting and avoid large allocations inside loops.

## Web Design Best Practices
- **Script:** `scripts/web_best_practices_check.py`
- **Test:** `scripts/test_web_best_practices_check.py`
- **Workflow:** `.github/workflows/web-best-practices.yml`
- **Purpose:** Checks for 12 web development best practices (semantic tags, responsive design, accessibility, performance, version control, documentation, etc.) in frontend code.
- **How to fix:** Follow output suggestions (add semantic tags, media queries, alt text, lazy loading, etc.).

## GitHub Workflow Organization
- **Location:** `.github/workflows/`
- **Principle:** Each workflow follows the Single Responsibility Principle (SRP). Related checks are combined only if SRP is maintained.
- **How to fix:** If a workflow fails, review the relevant script and documentation for guidance.

## Where to Learn More
- [docs/guides/easyflow_guide.md](../docs/guides/easyflow_guide.md) — Study guide and best practices
- [docs/README.md](../docs/README.md) — Documentation hub
- [docs/development/DAILY_DEVELOPER_GUIDE.md](../docs/development/DAILY_DEVELOPER_GUIDE.md) — Daily workflow
- [docs/devops/DEVOPS_PRODUCTIVITY_SUITE_INTEGRATION.md](../docs/devops/DEVOPS_PRODUCTIVITY_SUITE_INTEGRATION.md) — DevOps integration

---

**To run all checks locally:**
```bash
python scripts/complexity_analysis.py rpa-system/automation
python scripts/web_best_practices_check.py rpa-system/rpa-dashboard/src
python scripts/test_web_best_practices_check.py
```

**For more details, see the documentation above.**
