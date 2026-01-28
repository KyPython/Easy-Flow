# Namecheap DNS TXT Record Setup for Google Verification

## Step-by-Step Instructions for Namecheap

### 1. Log into Namecheap
- Go to: https://www.namecheap.com/
- Sign in to your account

### 2. Navigate to Domain List
- Click on **"Domain List"** in the left sidebar
- Find **tryeasyflow.com** in your domain list
- Click **"Manage"** next to it

### 3. Go to Advanced DNS
- Scroll down to **"Advanced DNS"** section
- Click on it to expand

### 4. Add TXT Record
- In the **"Host Records"** section, find the **"TXT Records"** area
- Click **"Add New Record"** button
- Fill in:
 - **Type:** Select `TXT Record`
 - **Host:** `@` (this means the root domain)
 - **Value:** `google-site-verification=0luN2b45mX9jAJnbvGhKK6jCF2fnN1cpcomZqW9hafw`
 - **TTL:** `Automatic` (or `30 min`)
- Click the **green checkmark** to save

### 5. Verify the Record
- You should see the new TXT record in the list
- It may take 10-30 minutes to propagate

### 6. Check DNS Propagation
After adding, verify it's live:
```bash
dig TXT tryeasyflow.com
```
Should show: `google-site-verification=0luN2b45mX9jAJnbvGhKK6jCF2fnN1cpcomZqW9hafw`

### 7. Complete Google Search Console Verification
- Go back to: https://search.google.com/search-console
- Click **"Verify"** button
- If it fails, wait up to 24 hours and try again

## Important Notes
- **Host field:** Use `@` for the root domain (tryeasyflow.com)
- **Multiple TXT records:** Namecheap allows multiple TXT records, so you can keep the old one if needed
- **Propagation time:** Usually 10-30 minutes, but can take up to 24 hours

## Troubleshooting
- If verification fails immediately: Wait 30 minutes and try again
- If still failing after 24 hours: Double-check the TXT record value matches exactly (no extra spaces)
- You can verify the record is live by running: `dig TXT tryeasyflow.com +short`
