# Stolen Laptop Security Guide

## Immediate Actions If Your Laptop Is Stolen

### 1. Revoke All Exposed Credentials (CRITICAL)

If your laptop is stolen, immediately rotate all credentials that may have been cached or stored locally:

#### Supabase Credentials
```bash
# Go to Supabase Dashboard → Settings → API
# Regenerate:
# - anon key
# - service_role key
# - database password
```

#### GitHub Token
```bash
# Go to GitHub → Settings → Developer settings → Personal access tokens
# Delete and regenerate any exposed tokens
# Check repo secrets in GitHub Actions
```

#### All OAuth Tokens
- Google OAuth (`.google_client_id`, `.google_client_secret`, `.google_refresh_token`)
- Stripe (`.stripe_token`, `.stripe_publishable_key`)
- Notion (`.notion_token`)
- Any other third-party API keys

### 2. Remote Session Invalidation

```bash
# Invalidate all active sessions on remote services:
# - Supabase: Settings → Sessions → Revoke all
# - GitHub: Settings → Sessions → Log out all devices
# - Cloud providers: Revoke active API tokens
```

---

## Preventive Security Measures

### Environment Variables Protection

Your `.gitignore` already blocks `.env*` files from being committed. Ensure:

```bash
# Verify .env is NOT tracked by git
git ls-files .env  # Should return empty
git ls-files .env.local  # Should return empty

# If files are tracked, remove them:
git rm --cached .env
git rm --cached .env.local
git commit -m "Remove sensitive env files from git tracking"
```

### Dev Bypass Token Security

The `DEV_BYPASS_TOKEN` in `rpa-system/backend/middleware/devBypassAuth.js` is your development convenience feature but also a security risk if stolen.

#### Current Security (Already Implemented)
- ✅ Only works when `NODE_ENV !== 'production'`
- ✅ Requires explicit `DEV_BYPASS_TOKEN` in environment
- ✅ Can be disabled with `DEV_BYPASS_ENABLED=false`

#### Additional Hardening (Recommended)

Add to your `.env`:
```bash
# Generate a secure token (64+ random characters)
DEV_BYPASS_TOKEN=$(openssl rand -hex 32)
DEV_BYPASS_ENABLED=false  # Default to disabled
```

### Git Security

#### Enable Commit Signing

```bash
# Generate GPG key (if not already done)
gpg --full-gen-key

# Configure Git to sign commits
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_KEY_ID

# Or use SSH signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

#### Branch Protection Rules

Configure in GitHub → Settings → Branches → Branch protection rules:

```
- Require pull request reviews before merging: ✅
- Require signed commits: ✅
- Require status checks to pass: ✅
- Include administrators: ✅
- Allow force push: ❌
- Allow deletion: ❌
```

### Remote Server Security

#### Supabase IP Allowlisting

Go to Supabase Dashboard → Settings → Database → Connection pooling:

```bash
# Allow only your known IPs
# Or use a VPN with fixed IP
```

#### Rotate Keys Immediately If Compromised

```bash
# Create a script to rotate all credentials
# Run immediately if laptop is stolen
./scripts/rotate-all-secrets.sh
```

---

## Local Development Security Checklist

Before each development session:

- [ ] Verify `NODE_ENV` is set correctly
- [ ] Confirm `DEV_BYPASS_ENABLED` is not accidentally `true` in production
- [ ] Check no sensitive files are accidentally committed
- [ ] Ensure Git commit signing is active
- [ ] Verify your VPN is active when working on sensitive projects

---

## Quick Response Script

Create `scripts/stolen-laptop-response.sh`:

```bash
#!/bin/bash
# Emergency script to run if laptop is stolen

echo "🚨 STOLEN LAPTOP RESPONSE SCRIPT 🚨"
echo "Revoking all exposed credentials..."

# 1. Revoke GitHub token
echo "1. Revoke GitHub token at: https://github.com/settings/tokens"

# 2. Revoke Supabase keys
echo "2. Regenerate Supabase keys at: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"

# 3. Revoke OAuth tokens
echo "3. Revoke Google OAuth: https://myaccount.google.com/permissions"
echo "4. Revoke Stripe: https://dashboard.stripe.com/account/developers"
echo "5. Revoke Notion: https://www.notion.so/my-integrations"

# 4. Invalidate sessions
echo "6. Log out all sessions on affected services"

echo "✅ Done! Now change all your passwords."
```

---

## Files to Check for Sensitive Data

If your laptop was stolen, audit these locations:

| File | Risk Level | Action |
|------|-----------|--------|
| `~/.npmrc` | Medium | Contains npm tokens |
| `~/.gitconfig` | Low | May contain credentials |
| `~/.ssh/` | High | Contains private keys |
| `~/Library/Keychains/` | High | System keychain |
| Browser cookies | High | Session data |
| LocalStorage (browser) | Medium | Token storage |

---

## Recovery Steps After Laptop Return

If you recover your laptop:

1. **Full security audit**: Treat it as compromised
2. **Rotate all credentials** (assume they were accessed)
3. **Check git history** for unauthorized commits
4. **Review access logs** on all services
5. **Enable additional security** (2FA, hardware keys)
