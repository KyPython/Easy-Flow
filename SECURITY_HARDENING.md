# 🔒 Security Hardening Guide
## Lead Magnet Automation System

This document outlines security best practices, required configurations, and emergency procedures for the EasyFlow Lead Magnet Automation system.

---

## 📋 Required GitHub Secrets

### Core API Access (Required)

| Secret Name | Purpose | How to Obtain | Security Level |
|-------------|---------|---------------|----------------|
| `REDDIT_CLIENT_ID` | Reddit API authentication | [Reddit Apps](https://www.reddit.com/prefs/apps) | **Critical** |
| `REDDIT_CLIENT_SECRET` | Reddit API authentication | Reddit App configuration | **Critical** |

### Notification Webhooks (Recommended)

| Secret Name | Purpose | How to Obtain | Security Level |
|-------------|---------|---------------|----------------|
| `SLACK_WEBHOOK_URL` | Success/failure notifications | [Slack Webhooks](https://api.slack.com/messaging/webhooks) | **Medium** |
| `DISCORD_WEBHOOK_URL` | Rich embed notifications | Discord Server Settings > Webhooks | **Medium** |

### Optional Extensions

| Secret Name | Purpose | Security Level |
|-------------|---------|----------------|
| `ADMIN_API_KEY` | Analytics endpoint access | **High** |

---

## 🛡️ Environment Protection Settings

### Repository Security Configuration

#### Branch Protection Rules
```yaml
# Settings > Branches > Add rule for 'main' branch
Required status checks: ✅
- lead_magnet_validation (if available)

Restrict pushes: ✅  
- Limit to administrators and service accounts

Require pull request reviews: ✅
- Required approving reviews: 1
- Dismiss stale reviews: ✅

Require conversation resolution: ✅
Allow force pushes: ❌
Allow deletions: ❌
```

#### Environment Protection Rules
```yaml
# Settings > Environments > production
Required reviewers: 
- Repository administrators
- DevOps team members

Deployment branches:
- Selected branches: main, release/*

Wait timer: 5 minutes
```

### Workflow Security

#### Minimal Permissions (Implemented)
```yaml
permissions:
  contents: write      # Only for committing generated files
  actions: none        # No workflow management access
  security-events: none # No security events access
```

#### Secret Scope Limitation
- Secrets are scoped to automation workflows only
- No secret exposure in logs or outputs
- Webhook URLs are validated before use

---

## 🔐 Permission Scoping Best Practices

### GitHub Actions Permissions

#### What the Workflow CAN Do:
- ✅ Read repository files and scripts
- ✅ Install Python dependencies  
- ✅ Execute automation scripts
- ✅ Write generated files back to repository
- ✅ Send notifications to configured webhooks
- ✅ Create workflow summaries and artifacts

#### What the Workflow CANNOT Do:
- ❌ Modify workflow files or GitHub Actions configuration
- ❌ Access security events or vulnerability data
- ❌ Manage repository settings or collaborators
- ❌ Create or modify GitHub releases
- ❌ Access other repositories or organizations

### Reddit API Permissions

The Reddit application requires minimal permissions:
- **Application Type**: `script` (not `web app`)
- **Scope**: Read-only access to public subreddits
- **Rate Limiting**: Respects 60 requests/minute limit
- **User Agent**: Clearly identifies the application purpose

---

## 🚨 Emergency Procedures

### Immediate Incident Response

#### 1. Disable Automation (Emergency Stop)
```bash
# Option A: Disable workflow schedule
# Edit .github/workflows/lead_magnet_automation.yml
# Comment out the 'schedule' trigger:
# on:
#   schedule:
#     - cron: '0 6 * * 1'  # ← Add # here
```

#### 2. Revoke API Access
```bash
# Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Click "edit" on EasyFlow Lead Magnet Bot
3. Click "revoke app" or regenerate credentials

# Webhook URLs  
1. Go to Slack/Discord webhook settings
2. Delete or regenerate webhook URLs
3. Update GitHub Secrets with new URLs (if needed)
```

#### 3. Emergency Rollback
```bash
# Revert last automation commit
git revert HEAD --no-edit
git push origin main

# Or rollback to specific commit
git reset --hard COMMIT_SHA
git push --force-with-lease origin main
```

### Security Incident Investigation

#### 1. Check Workflow Logs
```bash
# GitHub UI path:
# Repository > Actions > Lead Magnet Automation Pipeline > Latest run
# Review each step output for:
# - Unauthorized API calls
# - Unexpected file modifications  
# - Failed authentication attempts
# - Rate limiting violations
```

#### 2. Audit Generated Files
```bash
# Clone repository and check recent commits
git log --oneline --since="7 days ago"
git show COMMIT_SHA --stat

# Verify file integrity
find data/ checklists/ -name "*.json" -o -name "*.pdf" | xargs ls -la
```

#### 3. Reddit API Usage Review
```bash
# Check Reddit account activity
# https://www.reddit.com/user/YOUR_USERNAME/
# Look for unexpected posts, comments, or API usage
```

---

## 📊 Logging and Retention Policies

### Workflow Execution Logs

#### Retention Schedule
- **GitHub Actions Logs**: 90 days (GitHub default)  
- **Workflow Artifacts**: 30 days (configurable)
- **Generated Files**: Permanent (committed to repository)

#### Log Levels and Content
```yaml
INFO:  Normal operation messages, metrics, status updates
WARN:  Recoverable errors, fallback usage, rate limiting
ERROR: Failed operations, authentication issues, system errors
DEBUG: Detailed tracing (enabled via DEBUG_MODE=true)
```

#### Sensitive Data Handling
- ❌ **Never logged**: API keys, webhook URLs, user credentials
- ⚠️ **Sanitized**: Reddit usernames, sensitive content patterns  
- ✅ **Safe to log**: Public subreddit names, pain point categories, file paths

### Monitoring and Alerting

#### Success Metrics (Tracked)
- Workflow execution time and success rate
- Reddit API response times and rate limiting
- Generated file counts and sizes
- Cache hit rates and performance

#### Failure Scenarios (Monitored)  
- Authentication failures (Reddit, webhooks)
- Network connectivity issues
- File generation errors
- Repository commit failures

---

## 🔄 Rollback Instructions

### Quick Rollback (Emergency)

#### 1. Disable Scheduled Runs
```yaml
# In .github/workflows/lead_magnet_automation.yml
# Comment out or remove the schedule trigger:
on:
  # schedule:
  #   - cron: '0 6 * * 1'
  workflow_dispatch:  # Keep manual triggers for testing
```

#### 2. Revert Generated Files
```bash
# Option A: Revert last automation commit
git log --grep="Automated lead magnet generation" --oneline -5
git revert COMMIT_SHA

# Option B: Reset to previous state  
git checkout HEAD~1 -- data/ checklists/ reports/
git commit -m "🔄 Rollback: Reset generated files to previous state"
```

#### 3. Restore Backup Data
```bash
# If .backup files exist
cp messaging.md.backup messaging.md
cp data/reddit_pain_points.json.backup data/reddit_pain_points.json

# Commit restoration
git add -A
git commit -m "🔄 Restore: Recovered from backup files"
```

### Controlled Rollback (Planned)

#### 1. Create Rollback Branch
```bash
git checkout -b rollback/lead-magnet-automation
git push origin rollback/lead-magnet-automation
```

#### 2. Document Changes Before Rollback
```bash
# Create rollback summary
echo "## Rollback Summary - $(date)" > ROLLBACK_NOTES.md
echo "### Files to be restored:" >> ROLLBACK_NOTES.md
git diff --name-only HEAD~5 HEAD >> ROLLBACK_NOTES.md

git add ROLLBACK_NOTES.md
git commit -m "📝 Document rollback plan"
```

#### 3. Execute Controlled Rollback
```bash
# Reset to specific previous state
git reset --soft HEAD~3  # Adjust number as needed
git commit -m "🔄 Controlled rollback: Reset automation to previous state"

# Create pull request for review
gh pr create --title "🔄 Rollback Lead Magnet Automation" --body "See ROLLBACK_NOTES.md for details"
```

---

## 🛠️ Configuration Validation

### Pre-deployment Security Checklist

#### Repository Configuration
- [ ] ✅ Branch protection rules enabled on main branch
- [ ] ✅ Required status checks configured  
- [ ] ✅ Force push disabled for main branch
- [ ] ✅ Repository visibility set to private (if needed)

#### Secrets Management
- [ ] ✅ All required secrets configured in GitHub repository
- [ ] ✅ Secret values tested and validated (use validation workflow)
- [ ] ✅ No hardcoded credentials in source code
- [ ] ✅ Webhook URLs are active and authorized

#### Workflow Security
- [ ] ✅ Minimal permissions configured in workflow files
- [ ] ✅ No secret exposure in logs or job outputs
- [ ] ✅ Error handling prevents information disclosure
- [ ] ✅ Retry logic includes reasonable limits and backoff

#### External Dependencies  
- [ ] ✅ Reddit API app configured with minimal permissions
- [ ] ✅ Rate limiting respected (60 requests/minute)
- [ ] ✅ Webhook endpoints secured with HTTPS
- [ ] ✅ Third-party package versions pinned in requirements.txt

### Ongoing Security Maintenance

#### Weekly Tasks
- Monitor workflow execution logs for anomalies
- Review generated files for unexpected changes
- Check Reddit API usage statistics

#### Monthly Tasks  
- Rotate Reddit API credentials
- Audit GitHub repository access and permissions
- Review and test emergency rollback procedures

#### Quarterly Tasks
- Security audit of all workflow files and scripts
- Update dependencies and check for security vulnerabilities  
- Review and update this security documentation

---

## 🚀 Production Readiness Verification

### Final Security Sign-off

Before enabling production automation:

1. **✅ Security Review Completed**
   - All sections of this document reviewed
   - Security checklist items verified
   - Emergency procedures tested

2. **✅ Access Control Validated**  
   - GitHub repository permissions audited
   - API credentials scope verified
   - Webhook endpoints secured

3. **✅ Monitoring Established**
   - Success/failure notifications configured
   - Log retention policies implemented  
   - Incident response procedures documented

4. **✅ Rollback Capability Confirmed**
   - Emergency disable procedures tested
   - File restoration methods validated
   - Recovery time objectives established

### Approval Required From:
- [ ] **Repository Administrator**
- [ ] **Security Team Representative**  
- [ ] **DevOps/Platform Team**

### Production Deployment Date: `______________`

**Approver Signatures:**
- Security Review: `________________` Date: `______`
- Technical Review: `________________` Date: `______`
- Final Authorization: `________________` Date: `______`

---

## 📞 Emergency Contacts

### Incident Response Team

| Role | Contact | Availability |
|------|---------|--------------|
| **Repository Owner** | [GitHub @username] | 24/7 |
| **DevOps Lead** | [Contact info] | Business hours |
| **Security Team** | [Contact info] | 24/7 |

### External Services

| Service | Support | Documentation |
|---------|---------|---------------|
| **GitHub Actions** | [GitHub Support](https://support.github.com/) | [Actions Docs](https://docs.github.com/en/actions) |  
| **Reddit API** | [Reddit API Support](https://www.reddit.com/dev/api/) | [API Docs](https://www.reddit.com/dev/api/) |

---

*Last Updated: $(date +'%Y-%m-%d')*  
*Next Review Date: $(date -d '+3 months' +'%Y-%m-%d')*