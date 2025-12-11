# Polar Webhook Testing Guide

## ✅ Endpoint Status

**Endpoint**: `POST /api/polar-webhook/webhook`  
**Full URL**: `http://localhost:3030/api/polar-webhook/webhook` (or your production URL)

**Status**: ✅ **ACCESSIBLE** - Verified via OPTIONS request (returns 204)

## Quick Test

### 1. Test with the provided script:

```bash
# Make sure backend is running first
cd rpa-system/backend
NODE_ENV=development PORT=3030 node server.js

# In another terminal, run the test script:
node scripts/test_polar_webhook.js subscription.created your-email@example.com your-polar-product-id
```

### 2. Test with curl:

```bash
# Test subscription creation
curl -X POST http://localhost:3030/api/polar-webhook/webhook \
  -H "Content-Type: application/json" \
  -H "x-polar-signature: sha256=$(echo -n '{"type":"subscription.created","data":{"id":"test123","product_id":"test-product","status":"active","customer":{"email":"test@example.com"}}}' | openssl dgst -sha256 -hmac "test-secret" | cut -d' ' -f2)" \
  -d '{
    "type": "subscription.created",
    "data": {
      "id": "test123",
      "product_id": "test-product-id",
      "status": "active",
      "customer": {
        "email": "test@example.com"
      }
    }
  }'
```

### 3. Test with Polar Dashboard:

1. Go to Polar Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-production-domain.com/api/polar-webhook/webhook`
3. Set webhook secret: Copy from Polar dashboard → Settings → Webhooks → Webhook Secret
4. Set environment variable: `POLAR_WEBHOOK_SECRET=<your-secret>`
5. Subscribe to events:
   - ✅ `subscription.created`
   - ✅ `subscription.updated`
   - ✅ `subscription.active`
   - ✅ `subscription.canceled`
   - ✅ `subscription.revoked`
6. Click "Send Test Webhook" in Polar dashboard

## Expected Behavior

### When subscription is created/updated:
1. ✅ Subscription record created/updated in `subscriptions` table
2. ✅ User's `profiles.plan_id` updated to new plan
3. ✅ Realtime notification sent to frontend
4. ✅ User immediately gets access to plan features

### When subscription is canceled:
1. ✅ Subscription status set to 'canceled'
2. ✅ User's plan downgraded to 'free'
3. ✅ Realtime notification sent
4. ✅ User loses premium features immediately

## Verification Steps

1. **Check endpoint is accessible:**
   ```bash
   curl -X OPTIONS http://localhost:3030/api/polar-webhook/webhook -v
   ```
   Should return 200/204 with CORS headers

2. **Check database after webhook:**
   ```sql
   -- Check subscription was created/updated
   SELECT * FROM subscriptions WHERE external_payment_id = 'test123';
   
   -- Check user's plan was updated
   SELECT id, plan_id, plan_changed_at FROM profiles WHERE email = 'test@example.com';
   ```

3. **Check logs:**
   - Backend logs should show webhook received and processed
   - Look for: "Subscription created/updated for user"

## Troubleshooting

### Issue: Webhook returns 404
**Solution**: Check that `polarRoutes` is loaded and mounted:
- Check `app.js` line 702-704: `app.use('/api/polar-webhook', polarRoutes)`
- Check that `polarRoutes` is not null (check for errors loading the module)

### Issue: Webhook returns 401 (Invalid signature)
**Solution**: 
- In development: Webhook works without verification
- In production: Set `POLAR_WEBHOOK_SECRET` environment variable
- Verify signature matches Polar's signature format

### Issue: User not found (404)
**Solution**: 
- Ensure user exists in `profiles` table
- Email must match exactly (case-sensitive)
- Check: `SELECT * FROM profiles WHERE email = 'user@example.com'`

### Issue: Plan not found (404)
**Solution**:
- Verify `plans` table has entry with `external_product_id` matching Polar's `product_id`
- Check: `SELECT * FROM plans WHERE external_product_id = 'your-polar-product-id'`

### Issue: Plan not updating
**Solution**:
- Check database permissions
- Verify `profiles.plan_id` column exists
- Check backend logs for errors
- Verify subscription update succeeded before profile update

## Production Checklist

- [x] `POLAR_WEBHOOK_SECRET` is set in production environment ✅
- [x] `POLAR_API_KEY` is set in production environment ✅
- [x] Webhook URL is configured in Polar dashboard (HTTPS required) ✅
- [x] All required webhook events are subscribed ✅
- [x] Database tables are properly configured ✅
- [x] Plans table has `external_product_id` matching Polar product IDs ✅
- [ ] Test webhook from Polar dashboard succeeds (verify periodically)
- [ ] Monitor webhook processing in production logs (ongoing)

**Status**: ✅ **Polar is fully configured for production**

## Security Notes

1. **Webhook Verification**: Always verify signatures in production
2. **HTTPS**: Polar requires HTTPS for webhook URLs
3. **CORS**: Webhook endpoint allows all origins (needed for Polar)
4. **No Auth**: Webhook endpoint has no authentication (Polar authenticates via signature)
