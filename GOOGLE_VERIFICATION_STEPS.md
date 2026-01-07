# Google Domain Verification - Quick Steps

## Current Status
-  Code is in production (privacy policy links are live)
- ⏳ Waiting for DNS TXT record update
- ⏳ Domain verification pending in Google Search Console

## Step-by-Step Instructions

### 1. Add DNS TXT Record

**Go to your domain registrar** (where you bought tryeasyflow.com):
- GoDaddy, Namecheap, Google Domains, etc.

**Add this TXT record:**
- **Record Type:** `TXT`
- **Name/Host:** `@` or `tryeasyflow.com` (or leave blank - depends on your registrar)
- **TTL:** `3600` (or default)
- **Value:** `google-site-verification=0luN2b45mX9jAJnbvGhKK6jCF2fnN1cpcomZqW9hafw`

**Note:** You may already have an old verification token. You can either:
- Replace it with the new one, OR
- Add the new one alongside it (most DNS providers allow multiple TXT records)

### 2. Wait for DNS Propagation
- Wait **10-30 minutes** after adding the record
- You can check if it's live by running: `dig TXT tryeasyflow.com`

### 3. Verify in Google Search Console
1. Go back to: https://search.google.com/search-console
2. You should see "finish verification" or the verify button
3. Click **"Verify"**
4. If it fails, wait up to 24 hours and try again (DNS can be slow)

### 4. Request Branding Re-Verification
After domain verification succeeds:
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Scroll to "Branding verification issues"
3. Click **"I have fixed the issues"**
4. Click **"Request re-verification for your branding"**
5. Wait 24-48 hours for Google to re-crawl your site

## Verification Token
```
google-site-verification=0luN2b45mX9jAJnbvGhKK6jCF2fnN1cpcomZqW9hafw
```

## Quick Check Commands
```bash
# Check if TXT record is live
dig TXT tryeasyflow.com

# Should show the new verification token
```

