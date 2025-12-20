# Database Schema Compatibility for Polar Webhooks

## Schema Overview

Your database has a mixed schema for plan IDs:

### Tables Structure

1. **`plans` table**:
   - `id` (UUID) - Primary key
   - `external_product_id` (text) - Maps to Polar product IDs
   - `slug` (text) - Human-readable plan identifier
   - `name` (text) - Plan name

2. **`subscriptions` table**:
   - `plan_id` (UUID) - References `plans(id)`
   - `external_payment_id` (text) - Polar subscription ID
   - `status` (text) - 'active', 'canceled', 'trialing', 'past_due'

3. **`profiles` table**:
   - `plan_id` (text) - Can store UUID as string, slug, or name
   - Defaults to 'free'
   - Used by `planService.getUserPlan()` for feature checks

## How It Works

### Plan Resolution Strategy

The `planService.getUserPlan()` function handles both UUID and text lookups:

```javascript
// Checks if plan_id is UUID or text
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(planId);
const orQuery = isUuid 
  ? `id.eq.${planId},name.eq.${planId},slug.eq.${planId}`
  : `name.eq.${planId},slug.eq.${planId}`;
```

This means `profiles.plan_id` can store:
- ✅ UUID as string (e.g., "550e8400-e29b-41d4-a716-446655440000")
- ✅ Plan slug (e.g., "free", "professional")
- ✅ Plan name (e.g., "Free Plan", "Professional Plan")

### Webhook Handler Behavior

The Polar webhook handler now:

1. **Finds plan by Polar product_id**:
   - Returns both `id` (UUID) and `slug`/`name` (text)

2. **Updates subscriptions table**:
   - Uses `plan.id` (UUID) for `subscriptions.plan_id`

3. **Updates profiles table**:
   - Uses `plan.slug` or `plan.name` (text) for `profiles.plan_id`
   - Falls back to UUID as string if slug/name not available

4. **On cancellation**:
   - Finds free plan by slug/name
   - Updates `profiles.plan_id` to 'free' or plan slug

## Compatibility Status

✅ **Fully Compatible** - The schema mismatch is handled gracefully:

- `subscriptions.plan_id` (UUID) ← Stores plan UUID
- `profiles.plan_id` (text) ← Stores plan slug/name (preferred) or UUID as string
- `planService` handles both UUID and text lookups

## Recommendations

### Option 1: Keep Current Schema (Recommended)
- ✅ Works with current code
- ✅ Flexible (supports UUID or text)
- ✅ No migration needed

### Option 2: Standardize on UUIDs
If you want consistency, you could:
1. Change `profiles.plan_id` to UUID type
2. Add foreign key constraint to `plans(id)`
3. Update all existing 'free' values to actual plan UUIDs

**Current implementation uses Option 1** - it's flexible and works with your existing schema.

## Testing

The webhook handler has been tested to work with:
- ✅ UUID plan IDs in subscriptions
- ✅ Text plan IDs (slug/name) in profiles
- ✅ Mixed lookups in planService
- ✅ Cancellation downgrades to 'free' text

All Polar webhook flows should work correctly with your current schema.

