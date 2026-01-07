# GitHub Branch Protection Rules Setup

## Critical: Block Production Deployments Until All Checks Pass

This document explains how to configure GitHub branch protection rules to **prevent code from reaching production** if any required checks fail.

---

## Current Problem

**Workflows run AFTER pushes**, so they can't block the push itself. Without branch protection rules, code can be pushed to `main` even if workflows fail.

---

## Solution: GitHub Branch Protection Rules

Branch protection rules **require status checks to pass** before allowing:
- Direct pushes to `main`
- Merges from `dev` to `main`
- Force pushes

---

## Required Status Checks

Configure these workflows as **required status checks** in GitHub:

1. **QA — core feature tests** (`qa-core.yml`)
   - Workflow name: `QA — core feature tests`
   - Status check name: `qa`

2. **QA — Integration Tests** (`qa-integration.yml`)
   - Workflow name: `QA — Integration Tests`
   - Status check name: `integration`

3. **Code Validation — SRP, Dynamic, Theme, Logging** (`code-validation.yml`)
   - Workflow name: `Code Validation — SRP, Dynamic, Theme, Logging (Branch-Aware)`
   - Status check name: `validate`

4. **Terraform Validation** (`terraform-validate.yml`)
   - Workflow name: `Terraform Validation`
   - Status check name: `terraform`

5. **Monitor Email Queue** (`monitor-email-queue.yml`)
   - **NOTE: This is a MONITORING workflow only - do NOT add as required status check**
   - This workflow monitors email queue health and creates alerts
   - Failures should not block production deployments

---

## How to Set Up Branch Protection

### Step 1: Navigate to Branch Protection Settings

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/Easy-Flow`
2. Click **Settings** -> **Branches**
3. Under **Branch protection rules**, click **Add rule** (or edit existing rule for `main`)

### Step 2: Configure Protection Rule

**Branch name pattern:** `main`

**Enable these settings:**

**Require a pull request before merging**
- Require approvals: `1`
- Dismiss stale pull request approvals when new commits are pushed

**Require status checks to pass before merging**
- Require branches to be up to date before merging
- **Status checks that are required:**
  - `qa` (from `QA — core feature tests`)
  - `integration` (from `QA — Integration Tests`)
  - `validate` (from `Code Validation — SRP, Dynamic, Theme, Logging (Branch-Aware)`)
  - `terraform` (from `Terraform Validation`)
  - **DO NOT** add `Monitor Email Queue` - it's monitoring only, not a blocker

**Require conversation resolution before merging**

**Do not allow bypassing the above settings**
- Even for administrators

**Restrict who can push to matching branches**
- Add specific users/teams (optional, but recommended)

### Step 3: Save the Rule

Click **Create** (or **Save changes** if editing)

---

## 🧪 Testing Branch Protection

After setting up branch protection:

1. **Try to push directly to `main`:**
   ```bash
   git checkout main
   git commit --allow-empty -m "test: verify branch protection"
   git push origin main
   ```
   **Expected:** Push should be **blocked** if workflows haven't run or failed

2. **Try to merge `dev` -> `main` via PR:**
   - Create a PR from `dev` to `main`
   - **Expected:** PR cannot be merged until all required status checks pass

3. **Verify workflows are required:**
   - Go to the PR
   - Look for "Required" label on status checks
   - All 5 workflows should show as "Required"

---

## Verifying Status Check Names

To find the exact status check names:

1. Go to **Settings** -> **Branches**
2. Click **Add rule** for `main`
3. Scroll to **"Require status checks to pass before merging"**
4. Click **"Choose which status checks are required"**
5. You'll see a list of all available status checks

**Status check names format:**
- `{workflow-name} / {job-name}`
- Example: `QA — core feature tests / qa`

---

## Important Notes

1. **Workflows must run at least once** before they appear in the status check list
2. **Status check names are case-sensitive**
3. **Branch protection only works for:**
   - Pull requests (merges)
   - Direct pushes (if enabled)
   - Force pushes (if blocked)

4. **The `ship-to-production.sh` script** will still run local checks, but GitHub branch protection provides an additional safety net

---

## 🚨 If Status Checks Don't Appear

If you don't see the status checks in the list:

1. **Trigger the workflows manually:**
   - Go to **Actions** tab
   - Select each workflow
   - Click **"Run workflow"** -> Select `main` branch -> **Run workflow**

2. **Wait for workflows to complete** (they must run at least once)

3. **Refresh the branch protection settings page**

4. **The status checks should now appear** in the dropdown

---

## 📝 Alternative: Use GitHub API

If you prefer to configure via API:

```bash
# Set branch protection (requires GitHub CLI or curl)
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks[contexts][]="qa" \
  --field required_status_checks[contexts][]="integration" \
  --field required_status_checks[contexts][]="validate" \
  --field required_status_checks[contexts][]="terraform" \
  # NOTE: DO NOT add monitor-email-queue - it's monitoring only, not a blocker
  --field enforce_admins=true \
  --field required_pull_request_reviews[required_approving_review_count]=1
```

---

## Verification Checklist

After setup, verify:

- [ ] Branch protection rule exists for `main`
- [ ] All 5 required status checks are listed
- [ ] "Require branches to be up to date" is enabled
- [ ] "Do not allow bypassing" is enabled (for admins)
- [ ] Direct push to `main` is blocked (if configured)
- [ ] PRs cannot be merged until all checks pass
- [ ] Workflows actually fail when checks don't pass (see workflow fixes)

---

## 🔗 Related Documentation

- [GitHub Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)

