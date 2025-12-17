# Email Setup Guide - EasyFlow

**Problem:** Emails are being queued but not actually sent because no email service is configured.

**Solution:** Configure SendGrid or another email service provider.

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

