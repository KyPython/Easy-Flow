# Email Setup Guide - EasyFlow

**Problem:** Emails are being queued but not actually sent because no email service is configured.

**Solution:** Configure SendGrid or another email service provider.

---

## Setup Locations

You need to configure email service in **two places**:
1. **Local Development** - For testing on your machine
2. **Render Production** - For your deployed app on Render.com

---

## Quick Setup: SendGrid (Recommended)

### Step 1: Create SendGrid Account

1. Go to https://sendgrid.com and sign up (free tier: 100 emails/day)
2. Verify your email address
3. Complete account setup

### Step 2: Create API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `EasyFlow Production`
4. Select **Full Access** permissions
5. Copy the API key (you won't see it again!)

### Step 3: Verify Sender Email

1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in:
   - **From Email Address**: `noreply@useeasyflow.com` (or your domain)
   - **From Name**: `EasyFlow`
   - **Reply To**: `support@useeasyflow.com`
4. Check your email and click the verification link

---

## Local Development Setup

### Step 4: Configure Local Environment Variables

Add these to your `.env` file in `rpa-system/backend/`:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@useeasyflow.com
```

### Step 5: Install SendGrid Package Locally

```bash
cd rpa-system/backend
npm install @sendgrid/mail
```

### Step 6: Restart Local Backend

```bash
pm2 restart easyflow-backend
```

### Step 7: Verify Local Configuration

```bash
curl http://localhost:3030/api/email/health
```

Should return:
```json
{
  "ok": true,
  "sendgrid": true,
  "from": true
}
```

---

## Render Production Setup

### Step 8: Add Environment Variables to Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your **easyflow-backend** service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add these variables:

   **Variable 1:**
   - **Key:** `SENDGRID_API_KEY`
   - **Value:** `SG.your_api_key_here` (same key from Step 2)
   - **Sync:** Leave unchecked (sensitive)

   **Variable 2:**
   - **Key:** `SENDGRID_FROM_EMAIL`
   - **Value:** `noreply@useeasyflow.com` (verified sender from Step 3)
   - **Sync:** Leave unchecked

6. Click **Save Changes**
7. Render will automatically redeploy your service

### Step 9: Verify SendGrid Package is Installed

The `@sendgrid/mail` package should already be in your `package.json`. If not, add it:

```bash
cd rpa-system/backend
npm install @sendgrid/mail
git add package.json package-lock.json
git commit -m "Add @sendgrid/mail dependency"
git push
```

Render will install it during the next deployment.

### Step 10: Verify Render Configuration

After Render redeploys, check the service logs:

1. Go to Render dashboard → **easyflow-backend** → **Logs**
2. Look for: `✅ SendGrid configured for direct email sending`
3. Or check the health endpoint:
   ```bash
   curl https://your-render-backend-url.onrender.com/api/email/health
   ```

---

## Environment Variables Summary

### Required for Email Sending

| Variable | Local | Render | Description |
|----------|-------|--------|-------------|
| `SENDGRID_API_KEY` | ✅ `.env` | ✅ Render Dashboard | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | ✅ `.env` | ✅ Render Dashboard | Verified sender email |

### Optional (Alternative to SendGrid)

| Variable | Local | Render | Description |
|----------|-------|--------|-------------|
| `SEND_EMAIL_WEBHOOK` | ✅ `.env` | ✅ Render Dashboard | Webhook URL for email service |
| `SEND_EMAIL_WEBHOOK_SECRET` | ✅ `.env` | ✅ Render Dashboard | Webhook auth secret (if needed) |

---

## Render Dashboard Steps (Visual Guide)

1. **Navigate to Service:**
   ```
   Render Dashboard → Services → easyflow-backend
   ```

2. **Open Environment Tab:**
   ```
   Click "Environment" in the left sidebar
   ```

3. **Add Variables:**
   ```
   Click "Add Environment Variable" button
   Enter key and value
   Click "Save Changes"
   ```

4. **Redeploy:**
   ```
   Render automatically redeploys when env vars change
   Or manually: Click "Manual Deploy" → "Deploy latest commit"
   ```

---

## Testing Email Sending

### Test Locally

```bash
curl -X POST http://localhost:3030/api/enqueue-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "to_email": "your-email@example.com",
    "template": "success",
    "data": {
      "message": "Test email from EasyFlow",
      "workflow_name": "Test Workflow"
    }
  }'
```

### Test on Render

```bash
curl -X POST https://your-backend-url.onrender.com/api/enqueue-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "to_email": "your-email@example.com",
    "template": "success",
    "data": {
      "message": "Test email from EasyFlow Production",
      "workflow_name": "Test Workflow"
    }
  }'
```

---

## Troubleshooting

### Emails Still Not Sending on Render

1. **Check Render Environment Variables:**
   - Go to Render Dashboard → easyflow-backend → Environment
   - Verify `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` are set
   - Make sure there are no typos or extra spaces

2. **Check Render Logs:**
   - Go to Render Dashboard → easyflow-backend → Logs
   - Look for email-related errors
   - Search for: `email_worker`, `SendGrid`, `simulate send`

3. **Verify SendGrid Package:**
   - Check Render build logs for `@sendgrid/mail` installation
   - If missing, add to `package.json` and redeploy

4. **Check SendGrid Dashboard:**
   - Go to SendGrid → Activity
   - See if emails are being attempted
   - Check for bounce/spam reports

### Common Errors

**Error: "The from address does not match a verified Sender Identity"**
- **Fix:** Verify your FROM email in SendGrid dashboard (Settings → Sender Authentication)

**Error: "Invalid API key"**
- **Fix:** Regenerate API key in SendGrid and update in Render dashboard

**Error: "Email worker simulate send"**
- **Fix:** Environment variables not set in Render. Add them via Render dashboard.

---

## Current Status

✅ **Email Queue:** Working (emails are being queued)  
✅ **Email Worker:** Running (processing queue)  
❌ **Email Service:** Not configured (emails are simulated/logged only)

**Next Steps:**
1. Set up SendGrid account (Steps 1-3)
2. Configure locally for testing (Steps 4-7)
3. Configure on Render for production (Steps 8-10)

### Step 1: Create SendGrid Account

1. Go to https://sendgrid.com and sign up (free tier: 100 emails/day)
2. Verify your email address
3. Complete account setup

### Step 2: Create API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `EasyFlow Production`
4. Select **Full Access** permissions
5. Copy the API key (you won't see it again!)

### Step 3: Verify Sender Email

1. Go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in:
   - **From Email Address**: `noreply@useeasyflow.com` (or your domain)
   - **From Name**: `EasyFlow`
   - **Reply To**: `support@useeasyflow.com`
4. Check your email and click the verification link

### Step 4: Configure Environment Variables

Add these to your `.env` file in `rpa-system/backend/`:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@useeasyflow.com
```

### Step 5: Install SendGrid Package

```bash
cd rpa-system/backend
npm install @sendgrid/mail
```

### Step 6: Restart Backend

```bash
pm2 restart easyflow-backend
```

### Step 7: Verify Configuration

```bash
curl http://localhost:3030/api/email/health
```

Should return:
```json
{
  "ok": true,
  "sendgrid": true,
  "from": true
}
```

---

## Alternative: Resend (Modern Alternative)

### Step 1: Create Resend Account

1. Go to https://resend.com and sign up (free tier: 3,000 emails/month)
2. Verify your email

### Step 2: Create API Key

1. Go to **API Keys**
2. Click **Create API Key**
3. Name it: `EasyFlow Production`
4. Copy the API key

### Step 3: Add Domain

1. Go to **Domains**
2. Add your domain: `useeasyflow.com`
3. Add the DNS records to your domain provider
4. Wait for verification (usually 5-10 minutes)

### Step 4: Configure Webhook

Create a simple webhook endpoint (or use Resend's API directly):

**Option A: Use Resend API directly** (Update `email_worker.js` to use Resend SDK)

**Option B: Create webhook endpoint** that calls Resend API:

```javascript
// Example webhook endpoint
app.post('/api/resend-webhook', async (req, res) => {
  const { to_email, template, data } = req.body;
  // Call Resend API here
  // ...
});
```

Then set:
```bash
SEND_EMAIL_WEBHOOK=http://localhost:3030/api/resend-webhook
```

---

## Alternative: Postmark (Transactional Emails)

1. Sign up at https://postmarkapp.com
2. Create a server
3. Get your API key
4. Configure webhook or use Postmark SDK

---

## Testing Email Sending

### Test via API

```bash
curl -X POST http://localhost:3030/api/enqueue-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "to_email": "your-email@example.com",
    "template": "success",
    "data": {
      "message": "Test email from EasyFlow",
      "workflow_name": "Test Workflow"
    }
  }'
```

### Check Email Queue

Query the `email_queue` table in Supabase:
```sql
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 10;
```

### Check Email Worker Logs

```bash
tail -f logs/backend.log | grep email_worker
```

Look for:
- ✅ `Email sent via SendGrid` - Success!
- ⚠️ `No email service configured` - Still needs configuration
- ❌ `SendGrid send failed` - Check API key and FROM email

---

## Troubleshooting

### Emails Still Not Sending

1. **Check SendGrid API key:**
   ```bash
   # Verify API key is set
   echo $SENDGRID_API_KEY
   ```

2. **Check FROM email is verified:**
   - Go to SendGrid → Settings → Sender Authentication
   - Ensure your FROM email is verified (green checkmark)

3. **Check email worker logs:**
   ```bash
   tail -100 logs/backend.log | grep -i "email\|sendgrid"
   ```

4. **Check email queue status:**
   ```sql
   SELECT status, COUNT(*) FROM email_queue GROUP BY status;
   ```

### Common Errors

**Error: "The from address does not match a verified Sender Identity"**
- **Fix:** Verify your FROM email in SendGrid dashboard

**Error: "Invalid API key"**
- **Fix:** Regenerate API key and update `SENDGRID_API_KEY`

**Error: "Email worker simulate send"**
- **Fix:** No email service configured. Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`

---

## Current Status

✅ **Email Queue:** Working (emails are being queued)  
✅ **Email Worker:** Running (processing queue)  
❌ **Email Service:** Not configured (emails are simulated/logged only)

**Next Step:** Configure SendGrid (or another service) using the steps above.

