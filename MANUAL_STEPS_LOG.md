# Manual Configuration Steps Required

This document lists all manual configuration steps we encountered that should be automated in the DevOps Productivity Suite.

## 1. GitHub Branch Protection Rules
**Manual Step:** Configure branch protection via GitHub UI
**Current State:** Script exists (`setup-branch-protection.sh`) but requires GitHub CLI
**Should Be:** Fully automated template with GitHub API integration

## 2. OAuth Redirect URI Configuration
**Services:** Google, Slack, Notion, Meta (WhatsApp)
**Manual Steps:**
- Google Cloud Console: Add 8 redirect URIs (4 localhost, 4 production)
- Slack App Settings: Add HTTPS redirect URIs
- Notion Integration: Configure OAuth settings
- Meta/Facebook: Configure OAuth for WhatsApp

**Should Be:** Template generator that creates configuration files/scripts

## 3. Domain Verification (DNS TXT Records)
**Manual Step:** Add TXT record for Google Search Console verification
**Example:** `google-site-verification=TOKEN`
**Should Be:** DNS configuration template with instructions per provider (Namecheap, etc.)

## 4. Environment Variable Setup
**Manual Step:** Manually create/update `.env` files with secrets
**Should Be:** Environment template generator with validation

## 5. Database Migration Execution
**Manual Step:** Manually run SQL migrations in Supabase SQL Editor
**Should Be:** Automated migration runner with rollback support

## 6. API Enablement (Google Cloud)
**Manual Step:** Manually enable APIs (Gmail, Sheets, Drive, Calendar)
**Should Be:** API enablement script/template

## 7. Service Account Configuration
**Manual Step:** Create service accounts, download keys, configure permissions
**Should Be:** Service account setup automation

## 8. Webhook Configuration
**Manual Step:** Configure webhook URLs in external services
**Should Be:** Webhook configuration templates

## 9. Firebase Project Configuration
**Manual Step:** Match project IDs between frontend/backend
**Should Be:** Firebase configuration validator/synchronizer

## 10. CI/CD Workflow Trigger Configuration
**Manual Step:** Ensure workflows run on correct branches
**Should Be:** Workflow trigger validation/template
