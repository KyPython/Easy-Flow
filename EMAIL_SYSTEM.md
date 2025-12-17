# EasyFlow Email System Documentation

**Last Updated:** 2025-12-17

## Overview

EasyFlow uses a **queue-based email system** that supports multiple email service providers. Emails from workflows are queued in Supabase and processed asynchronously by a background worker.

---

## Email Service Architecture

### Email Flow

```
Workflow Execution
    ↓
Email Step Executes
    ↓
Email Queued in Supabase (email_queue table)
    ↓
Email Worker Polls Queue
    ↓
Email Sent via Configured Service
```

### Email Service Options

The system supports **three methods** for sending emails (in priority order):

#### 1. **Webhook Method** (Primary - if `SEND_EMAIL_WEBHOOK` is set)
- **Service**: Any email service with a webhook API (SendGrid, Resend, Postmark, etc.)
- **Configuration**: `SEND_EMAIL_WEBHOOK` environment variable
- **How it works**: Email worker sends POST request to webhook URL with email data
- **From Address**: Configured by the webhook service (not in EasyFlow code)

#### 2. **Direct SendGrid** (Fallback - if `SENDGRID_API_KEY` is set)
- **Service**: SendGrid (via `@sendgrid/mail` package)
- **Configuration**: 
  - `SENDGRID_API_KEY` - SendGrid API key
  - `SENDGRID_FROM_EMAIL` or `FROM_EMAIL` - Sender email address
- **How it works**: Direct API call to SendGrid
- **From Address**: Value of `SENDGRID_FROM_EMAIL` or `FROM_EMAIL` environment variable

#### 3. **Development Mode** (Fallback - if neither is configured)
- **Service**: None (logs only)
- **How it works**: Email worker logs the email to console/logs but doesn't actually send
- **Use Case**: Local development when email service isn't configured

---

## Current Configuration

Based on the codebase:

### Email Worker Status
✅ **Email worker is running** (heartbeat logs confirm it's active)

### Email Queue Processing
✅ **Emails are being queued successfully** (workflow executions show email steps completing)

### Email Service Detection

To determine which service is actually sending emails, check:

1. **Check environment variables:**
   ```bash
   # Check if webhook is configured
   echo $SEND_EMAIL_WEBHOOK
   
   # Check if SendGrid is configured
   echo $SENDGRID_API_KEY
   echo $SENDGRID_FROM_EMAIL
   ```

2. **Check backend logs for email processing:**
   ```bash
   tail -100 logs/backend.log | grep "email_worker\|sendgrid\|webhook"
   ```

3. **Check email worker logs:**
   - Look for `[email_worker] processing` logs
   - If you see `simulate send`, it's in development mode
   - If you see webhook URLs, it's using webhook method
   - If you see SendGrid API calls, it's using SendGrid directly

---

## Email Queue Schema

Emails are stored in the `email_queue` table with:
- `id` - Queue item ID (UUID)
- `to_email` - Recipient email address
- `template` - Email template name (e.g., "success", "welcome")
- `data` - Template variables (JSON)
- `status` - Status: `pending`, `sending`, `sent`, `failed`
- `scheduled_at` - When to send the email
- `attempts` - Number of send attempts
- `last_error` - Error message if failed

---

## Email Templates

Available templates:
- `success` - Success notification (used in workflows)
- `welcome` - Welcome email for new users
- `followup` - Follow-up email
- `automation_tips` - Automation tips email
- `custom` - Custom email with custom content

---

## Finding Your Email Service Configuration

### Method 1: Check Environment Variables

```bash
# In your terminal
cd /Users/ky/Easy-Flow
pm2 env easyflow-backend | grep -E "SEND|EMAIL"
```

### Method 2: Check Backend Health Endpoint

```bash
curl http://localhost:3030/api/email/health
```

Response will show:
```json
{
  "ok": true,
  "sendgrid": true/false,  // Whether SendGrid is configured
  "from": true/false        // Whether FROM email is configured
}
```

### Method 3: Check Email Queue in Database

Query the `email_queue` table to see:
- Which emails have been sent
- Which emails failed
- The actual email addresses being used

---

## Determining the "From" Email Address

The **FROM email address** depends on your configuration:

### If Using Webhook (`SEND_EMAIL_WEBHOOK`)
- The FROM address is configured **in your webhook service** (SendGrid, Resend, etc.)
- Check your webhook service dashboard for the sender email
- Common domains: `noreply@useeasyflow.com`, `hello@useeasyflow.com`, `notifications@useeasyflow.com`

### If Using Direct SendGrid
- The FROM address is set by `SENDGRID_FROM_EMAIL` or `FROM_EMAIL` environment variable
- Must be a verified sender in your SendGrid account
- Common format: `noreply@useeasyflow.com` or `hello@useeasyflow.com`

### To Find Your Actual FROM Address

1. **Check your email inbox** - Look at a received email's "From" field
2. **Check webhook service dashboard** - If using webhook, check the service's sender configuration
3. **Check SendGrid dashboard** - If using SendGrid, check verified senders
4. **Check environment variables** - `SENDGRID_FROM_EMAIL` or `FROM_EMAIL`

---

## Email Worker Configuration

The email worker runs embedded in the backend process and:
- Polls the `email_queue` table every 5 seconds (`EMAIL_WORKER_POLL_MS`)
- Processes emails in FIFO order (oldest first)
- Retries failed emails up to 5 times (`MAX_ATTEMPTS`)
- Uses exponential backoff for retries

---

## Troubleshooting

### Emails Not Sending

1. **Check email worker is running:**
   ```bash
   tail -20 logs/backend.log | grep "email_worker"
   ```
   Should see heartbeat logs every 60 seconds

2. **Check email queue:**
   ```sql
   SELECT * FROM email_queue WHERE status = 'pending' ORDER BY created_at;
   ```

3. **Check for errors:**
   ```bash
   tail -100 logs/backend.log | grep -i "email.*error\|email.*fail"
   ```

### Finding Which Service is Configured

Run this diagnostic:
```bash
curl http://localhost:3030/api/email/health
```

- If `sendgrid: true` → Using SendGrid directly
- If `sendgrid: false` and emails are sending → Using webhook
- If `sendgrid: false` and emails aren't sending → Development mode (logging only)

---

## Summary

**Email Service**: 
- Primary: Webhook (`SEND_EMAIL_WEBHOOK`) - if configured
- Fallback: SendGrid (`SENDGRID_API_KEY`) - if configured  
- Development: Logging only - if neither configured

**From Email Address**:
- Configured in webhook service (if using webhook)
- Or `SENDGRID_FROM_EMAIL` / `FROM_EMAIL` env var (if using SendGrid)
- Likely domain: `@useeasyflow.com` (e.g., `noreply@useeasyflow.com`)

**To find your actual configuration**, check:
1. Environment variables (`SEND_EMAIL_WEBHOOK`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`)
2. Received emails in your inbox (check the "From" field)
3. Your email service dashboard (SendGrid, Resend, etc.)

