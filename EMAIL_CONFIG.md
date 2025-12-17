# Email Configuration - Quick Reference

## Environment Variables

### Required
- `SENDGRID_API_KEY` - Your SendGrid API key
- `SENDGRID_FROM_EMAIL` - Verified sender email address

### Optional
- `SENDGRID_FROM_NAME` - Display name for sender (default: "EasyFlow")
  - Example: `EasyFlow App` will show as "EasyFlow App <noreply@useeasyflow.com>"

---

## Your Current Configuration

**SendGrid API Key:** `SG.your_api_key_here` (set in environment variables)

**FROM Email:** Set this to your verified SendGrid sender email (e.g., `noreply@useeasyflow.com`)

**FROM Name:** `EasyFlow App` (optional - will show as "EasyFlow App <email>")

---

## Setup Instructions

### 1. Verify Sender Email in SendGrid

**IMPORTANT:** Before you can send emails, you must verify the sender email in SendGrid:

1. Go to https://app.sendgrid.com → **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Enter:
   - **From Email Address**: `noreply@useeasyflow.com` (or your preferred email)
   - **From Name**: `EasyFlow App`
   - **Reply To**: `support@useeasyflow.com`
4. Check your email and click the verification link
5. Wait for verification (usually instant, but can take a few minutes)

### 2. Configure Local Development

Create or edit `rpa-system/backend/.env`:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@useeasyflow.com
SENDGRID_FROM_NAME=EasyFlow App
```

**Replace `noreply@useeasyflow.com` with your actual verified sender email from SendGrid.**

Then restart:
```bash
pm2 restart easyflow-backend
```

### 3. Configure Render Production

1. Go to https://dashboard.render.com
2. Click on **easyflow-backend** service
3. Go to **Environment** tab
4. Add these environment variables:

   **Variable 1:**
   - **Key:** `SENDGRID_API_KEY`
   - **Value:** `SG.your_api_key_here` (your actual SendGrid API key)
   - **Sync:** ❌ Unchecked (sensitive)

   **Variable 2:**
   - **Key:** `SENDGRID_FROM_EMAIL`
   - **Value:** `noreply@useeasyflow.com` (your verified sender email)
   - **Sync:** ❌ Unchecked

   **Variable 3:**
   - **Key:** `SENDGRID_FROM_NAME`
   - **Value:** `EasyFlow App`
   - **Sync:** ❌ Unchecked

5. Click **Save Changes**
6. Render will automatically redeploy

---

## Changing the FROM Email

To change the FROM email address:

1. **Verify new email in SendGrid:**
   - Go to SendGrid → Settings → Sender Authentication
   - Verify the new email address

2. **Update environment variables:**
   - **Local:** Update `SENDGRID_FROM_EMAIL` in `rpa-system/backend/.env`
   - **Render:** Update `SENDGRID_FROM_EMAIL` in Render dashboard → Environment

3. **Restart services:**
   - **Local:** `pm2 restart easyflow-backend`
   - **Render:** Will auto-redeploy when env vars change

---

## FROM Email Format

The system supports two formats:

1. **Email only:** `noreply@useeasyflow.com`
   - Shows as: `noreply@useeasyflow.com`

2. **Name + Email:** Set `SENDGRID_FROM_NAME=EasyFlow App`
   - Shows as: `EasyFlow App <noreply@useeasyflow.com>`

---

## Testing

### Test Locally

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

### Test Email Sending

Run a workflow with an email step, or use the API:

```bash
curl -X POST http://localhost:3030/api/enqueue-email \
  -H "Content-Type: application/json" \
  -d '{
    "to_email": "your-email@example.com",
    "template": "success",
    "data": {
      "message": "Test email",
      "workflow_name": "Test"
    }
  }'
```

Check your inbox - emails should arrive from "EasyFlow App <noreply@useeasyflow.com>"

---

## Troubleshooting

### "The from address does not match a verified Sender Identity"
- **Fix:** Verify the email in SendGrid dashboard first
- Go to SendGrid → Settings → Sender Authentication
- Make sure your FROM email has a green checkmark ✅

### Emails not sending
- Check logs: `tail -f logs/backend.log | grep email_worker`
- Look for: `✅ Email sent via SendGrid` (success) or `❌ SendGrid send failed` (error)
- Verify env vars are set: `curl http://localhost:3030/api/email/health`

