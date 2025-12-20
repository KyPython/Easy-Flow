# Git Workflow Guide for EasyFlow

> **"Source Code Control"** - The Pragmatic Programmer

This guide documents the Git workflow and branching strategies used in EasyFlow, adapted from [git-workflows-sample](https://github.com/KyPython/git-workflows-sample).

## 🎯 Overview

EasyFlow follows a **feature branch workflow** with conventional commit messages and automated validation. This ensures:

- ✅ Consistent branch naming
- ✅ Clear commit history
- ✅ Easy code review
- ✅ Safe collaboration

## 🌿 Branching Strategy

### Branch Types

We use a **prefix-based branching strategy**:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/add-logging` |
| `bugfix/` | Bug fixes | `bugfix/fix-auth-error` |
| `hotfix/` | Critical production fixes | `hotfix/fix-security-issue` |
| `release/` | Release preparation | `release/v1.2.0` |

### Main Branches

- **`main`** - Production-ready code (always deployable)
- **`develop`** - Integration branch for features (optional)

## 📝 Commit Message Convention

We follow the **Conventional Commits** specification:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add OAuth login` |
| `fix` | Bug fix | `fix(api): resolve timeout issue` |
| `docs` | Documentation | `docs: update README` |
| `style` | Code style (formatting) | `style: format with prettier` |
| `refactor` | Code refactoring | `refactor(utils): simplify error handling` |
| `test` | Adding tests | `test(api): add integration tests` |
| `chore` | Maintenance tasks | `chore: update dependencies` |
| `perf` | Performance improvements | `perf(db): optimize query` |
| `ci` | CI/CD changes | `ci: add GitHub Actions workflow` |
| `build` | Build system changes | `build: update webpack config` |
| `revert` | Revert previous commit | `revert: revert "feat: add feature X"` |

### Examples

```bash
# Good commit messages
feat(auth): add user authentication
fix(api): resolve 500 error on invoice download
docs: update installation guide
refactor(kafka): improve error handling
test(backend): add unit tests for user service

# Bad commit messages
added stuff
fix bug
update
WIP
```

## 🚀 Common Workflows

### 1. Starting a New Feature

```bash
# Create a feature branch
./scripts/git-workflow-helper.sh branch:create feature/add-logging

# Or manually
git checkout main
git pull origin main
git checkout -b feature/add-logging
```

### 2. Making Changes and Committing

```bash
# Make your changes
# ...

# Stage changes
git add .

# Validate commit message before committing
./scripts/git-workflow-helper.sh commit:validate "feat(auth): add login functionality"

# Commit with validated message
git commit -m "feat(auth): add login functionality"
```

### 3. Checking Branch Status

```bash
# Check current branch status
./scripts/git-workflow-helper.sh branch:status

# Check if ready for PR
./scripts/git-workflow-helper.sh status
```

### 4. Keeping Branch Up to Date

```bash
# Rebase onto main
./scripts/git-workflow-helper.sh rebase

# Or rebase onto different branch
./scripts/git-workflow-helper.sh rebase --base develop
```

### 5. Creating a Pull Request

```bash
# 1. Ensure branch is ready
./scripts/git-workflow-helper.sh status

# 2. Push branch
git push origin feature/your-feature

# 3. Create PR on GitHub
# The PR will automatically trigger CI/CD checks
```

## 🛠️ Git Workflow Helper Tool

EasyFlow includes a Git workflow helper script that automates common tasks:

### Available Commands

```bash
# Branch management
./scripts/git-workflow-helper.sh branch:create <name>     # Create feature branch
./scripts/git-workflow-helper.sh branch:status            # Check branch status
./scripts/git-workflow-helper.sh branch:validate <name>   # Validate branch name

# Commit validation
./scripts/git-workflow-helper.sh commit:check              # Check last commit
./scripts/git-workflow-helper.sh commit:validate <msg>     # Validate commit message

# PR readiness
./scripts/git-workflow-helper.sh status                    # Check PR readiness

# Rebase helper
./scripts/git-workflow-helper.sh rebase [--base <branch>]  # Rebase branch
```

### Short Aliases

You can create aliases in your shell config (`.bashrc` or `.zshrc`):

```bash
alias gwf='./scripts/git-workflow-helper.sh'
alias gbc='gwf branch:create'
alias gbs='gwf branch:status'
alias gcc='gwf commit:check'
alias gst='gwf status'
alias grb='gwf rebase'
```

Then use:
```bash
gbc feature/add-logging
gst
grb
```

## ✅ Pre-Commit Validation

EasyFlow includes pre-commit hooks that automatically validate:

- ✅ Code linting (frontend + backend)
- ✅ Tests (if configured)
- ✅ Build verification
- ✅ Environment checks

The pre-commit hook runs automatically when you commit. To bypass (not recommended):

```bash
git commit --no-verify
```

## 🔄 Pull Request Process

### Before Creating a PR

1. **Check PR readiness:**
   ```bash
   ./scripts/git-workflow-helper.sh status
   ```

2. **Ensure all checks pass:**
   - ✅ No uncommitted changes
   - ✅ Branch name follows convention
   - ✅ All commit messages are valid
   - ✅ Branch is up to date with main

3. **Run tests locally:**
   ```bash
   npm run test:all
   ```

### PR Checklist

- [ ] Branch name follows convention (`feature/`, `bugfix/`, etc.)
- [ ] All commits follow Conventional Commits format
- [ ] Code is linted and formatted
- [ ] Tests pass locally
- [ ] Branch is rebased on latest `main`
- [ ] PR description explains changes
- [ ] Related issues are referenced

### PR Title Convention

PR titles should follow the same convention as commits:

```
feat(auth): add OAuth login
fix(api): resolve timeout issue
docs: update installation guide
```

## 🔀 Rebase vs Merge

We prefer **rebase** for feature branches to keep a clean, linear history:

```bash
# Rebase your feature branch onto main
./scripts/git-workflow-helper.sh rebase

# If already pushed, force push with lease (safer than --force)
git push --force-with-lease origin feature/your-feature
```

**Why rebase?**
- ✅ Clean, linear history
- ✅ Easier to review
- ✅ Better for `git bisect`
- ✅ Simpler to understand project evolution

## 🚨 Handling Conflicts

### During Rebase

If conflicts occur during rebase:

```bash
# 1. Resolve conflicts in files
# Edit conflicted files, remove conflict markers

# 2. Stage resolved files
git add <resolved-files>

# 3. Continue rebase
git rebase --continue

# 4. If you need to abort
git rebase --abort
```

## 📋 Complete Feature Workflow Example

```bash
# 1. Create feature branch
./scripts/git-workflow-helper.sh branch:create feature/add-logging

# 2. Make changes
# ... edit files ...

# 3. Stage and commit
git add .
git commit -m "feat(logging): add structured logging"

# 4. Validate commit
./scripts/git-workflow-helper.sh commit:check

# 5. Make more changes
# ... edit files ...

git add .
git commit -m "test(logging): add logging tests"

# 6. Check status
./scripts/git-workflow-helper.sh branch:status

# 7. Rebase if needed
./scripts/git-workflow-helper.sh rebase

# 8. Check PR readiness
./scripts/git-workflow-helper.sh status

# 9. Push and create PR
git push origin feature/add-logging
```

## 🎓 Best Practices

### Do's ✅

- ✅ Use descriptive branch names
- ✅ Write clear commit messages
- ✅ Keep commits focused (one logical change per commit)
- ✅ Rebase before creating PR
- ✅ Run tests before pushing
- ✅ Review your own changes before PR

### Don'ts ❌

- ❌ Commit directly to `main`
- ❌ Use vague commit messages ("fix bug", "update")
- ❌ Mix unrelated changes in one commit
- ❌ Force push to shared branches
- ❌ Skip pre-commit hooks without good reason
- ❌ Create PRs with failing tests

## 🔗 Integration with CI/CD

GitHub Actions workflows automatically:

- ✅ Validate commit messages
- ✅ Run tests on PR
- ✅ Check code quality
- ✅ Verify builds

See `.github/workflows/` for details.

## 📋 Pull Request Process

### PR Template

EasyFlow uses a PR template (`.github/pull_request_template.md`) that includes:

- Description of changes
- Type of change (bug fix, feature, etc.)
- Related issues
- Testing information
- Checklist for pre-submission and code quality

### PR Review Guidelines

See [CODE_REVIEW_GUIDELINES.md](.github/CODE_REVIEW_GUIDELINES.md) for:

- Review checklist
- Review process
- Code style guidelines
- What to look for
- Review best practices

### Automated PR Checks

GitHub Actions automatically:

- ✅ Run tests on PR
- ✅ Check code quality (linting)
- ✅ Verify builds
- ✅ Run AI code review (Claude)
- ✅ Validate commit messages

## 📚 References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Workflows Sample](https://github.com/KyPython/git-workflows-sample)
- [Code Review Guidelines](.github/CODE_REVIEW_GUIDELINES.md)
- [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/) - Chapter on Source Code Control

---

**Remember**: Good Git practices make collaboration easier and code history more valuable. Follow these conventions to keep EasyFlow's repository clean and maintainable.

