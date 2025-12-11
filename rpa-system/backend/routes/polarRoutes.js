
const { logger, getLogger } = require('../utils/logger');
const express = require('express');
const crypto = require('crypto');
const { getSupabase } = require('../utils/supabaseClient');

const router = express.Router();
const { requireFeature } = require('../middleware/planEnforcement');

// ✅ FIX: CORS headers for webhook endpoint (handled by main CORS middleware, but ensure webhook works)
// The main CORS middleware already handles requests without origin, but we ensure webhook is accessible
router.use('/webhook', (req, res, next) => {
  // Ensure CORS headers are set (backup in case main CORS middleware doesn't catch it)
  if (!res.headersSent) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-polar-signature');
  }
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Make Supabase optional for local development
const supabase = getSupabase();
if (!supabase) {
  logger.warn('⚠️ Supabase not configured - polar routes disabled for local dev');
}

// Canonical checkout endpoint: returns all plans/features/pricing for Polar checkout
router.get('/checkout', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Service unavailable - database not configured' });
    }

    // Fetch all plans with their features and external product IDs
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*');
    if (error) throw error;

    // Fetch all features (if you have a features table, otherwise skip)
    let features = [];
    if (supabase.from('features')) {
      const { data: featuresData, error: featuresError } = await supabase
        .from('features')
        .select('*');
      if (!featuresError && featuresData) features = featuresData;
    }

    // Optionally, fetch feature order/labels from a config table if you have one
    // For now, just return plans and features
    return res.json({
      plans: plans || [],
      features: features || [],
      source: 'supabase',
      fetched_at: new Date().toISOString()
    });
  } catch (err) {
    logger.error('[GET /api/checkout/polar] Error:', err.message || err);
    return res.status(500).json({ error: 'Failed to fetch plans for checkout', details: err.message || String(err) });
  }
});

function verifyPolarWebhook(rawBody, signature, secret) {
  if (!secret || !signature) {
    logger.warn('Missing webhook secret or signature');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
}

async function findUserByEmail(email) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error finding user by email:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    logger.error('Error in findUserByEmail:', err);
    return null;
  }
}

async function findPlanByPolarProductId(polarProductId) {
  try {
    // ✅ FIX: Get both id (UUID) and slug/name for compatibility with profiles.plan_id (text)
    const { data, error } = await supabase
      .from('plans')
      .select('id, slug, name')
      .eq('external_product_id', polarProductId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error finding plan by polar product ID:', error);
      return null;
    }

    if (!data) return null;
    
    // Return object with both UUID (for subscriptions) and slug/name (for profiles)
    // profiles.plan_id is text, so we can store UUID as string or use slug/name
    // planService handles both UUID and text lookups, so UUID string works fine
    return {
      id: data.id, // UUID for subscriptions.plan_id
      slug: data.slug || data.name, // For profiles.plan_id (text field)
      name: data.name
    };
  } catch (err) {
    logger.error('Error in findPlanByPolarProductId:', err);
    return null;
  }
}

async function updateUserSubscription(userId, planId, externalPaymentId, status = 'active', subscription = null, planSlug = null) {
  try {
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error('Error fetching existing subscription:', fetchError);
      return false;
    }

    let subscriptionResult;

    // Calculate trial and billing dates
    const now = new Date();
    const trialEndsAt = subscription?.trial_end ? new Date(subscription.trial_end) : null;
    const isInTrial = trialEndsAt && trialEndsAt > now;
    const billingCycleAnchor = subscription?.billing_cycle_anchor ? new Date(subscription.billing_cycle_anchor) : null;

    if (existingSubscription) {
      const updateData = {
        plan_id: planId,
        status: status,
        external_payment_id: externalPaymentId,
        updated_at: new Date().toISOString()
      };

      // Add trial information if available
      if (trialEndsAt) {
        updateData.trial_ends_at = trialEndsAt.toISOString();
        updateData.is_trial = isInTrial;
      }
      if (billingCycleAnchor) {
        updateData.next_billing_at = billingCycleAnchor.toISOString();
      }

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('Error updating subscription:', updateError);
        return false;
      }
      subscriptionResult = { action: 'updated' };
    } else {
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: status,
          external_payment_id: externalPaymentId,
          started_at: new Date().toISOString()
        });

      if (insertError) {
        logger.error('Error creating subscription:', insertError);
        return false;
      }
      subscriptionResult = { action: 'created' };
    }

    // ✅ FIX: profiles.plan_id is text, so use plan slug/name if available, otherwise UUID as string
    // planService handles both UUID and text lookups, so either works
    const profilePlanId = planSlug || planId.toString();
    
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        plan_id: profilePlanId,
        plan_changed_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      logger.error('Error updating profile plan:', profileError);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Profile plan updated for user ${userId} to plan ${planId}`);
      }
      
      // Send a realtime notification to ensure frontend updates
      try {
        await supabase
          .channel('plan-notifications')
          .send({
            type: 'broadcast',
            event: 'plan_updated',
            payload: {
              user_id: userId,
              plan_id: planId,
              updated_at: new Date().toISOString(),
              trigger: 'polar_webhook'
            }
          });
      } catch (broadcastError) {
        logger.warn('Failed to send realtime notification:', broadcastError);
      }
    }

    return subscriptionResult;
  } catch (err) {
    logger.error('Error in updateUserSubscription:', err);
    return false;
  }
}

// No paywall on webhook endpoint (external system)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const startTime = Date.now();

  try {
    const signature = req.headers['x-polar-signature'];
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn('POLAR_WEBHOOK_SECRET not configured - webhook verification disabled');
      // In production, require webhook secret. In dev, allow without verification for testing.
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }
    }

    // Only verify signature if webhook secret is configured
    if (webhookSecret && !verifyPolarWebhook(req.body, signature, webhookSecret)) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(req.body.toString());
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Received Polar webhook:', {
      type: payload.type,
      id: payload.data?.id,
      timestamp: new Date().toISOString()
    });

    switch (payload.type) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.active': {
        const subscription = payload.data;
        const userEmail = subscription.customer?.email || subscription.user?.email;

        if (!userEmail) {
          logger.error('No customer email in subscription payload');
          return res.status(400).json({ error: 'Missing customer email' });
        }

        const userId = await findUserByEmail(userEmail);
        if (!userId) {
          logger.error(`User not found for email: ${userEmail}`);
          return res.status(404).json({ error: 'User not found' });
        }

        const planData = await findPlanByPolarProductId(subscription.product_id);
        if (!planData) {
          logger.error(`Plan not found for Polar product ID: ${subscription.product_id}`);
          return res.status(404).json({ error: 'Plan not found' });
        }

        // ✅ FIX: Use plan UUID for subscriptions table, slug/name for profiles table
        const planId = planData.id; // UUID for subscriptions.plan_id
        const planSlug = planData.slug || planData.name; // Text for profiles.plan_id

        // ✅ FIX: Pass full subscription object to capture trial and billing cycle info
        const result = await updateUserSubscription(
          userId,
          planId,
          subscription.id,
          subscription.status,
          subscription, // Pass full subscription object for trial_end, billing_cycle_anchor, etc.
          planSlug // Pass slug/name for profiles.plan_id update
        );

        if (!result) {
          return res.status(500).json({ error: 'Failed to update subscription' });
        }

        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Subscription ${result.action} for user ${userId}:`, {
          planId: planId,
          planSlug: planSlug,
          externalPaymentId: subscription.id,
          status: subscription.status
        });

        return res.status(200).json({
          success: true,
          action: result.action,
          userId,
            duration_ms: Date.now() - startTime
          });
        }
        break;
      }
        case 'subscription.canceled':
      case 'subscription.revoked': {
        const subscription = payload.data;
        const userEmail = subscription.customer?.email || subscription.user?.email;

        if (!userEmail) {
          logger.error('No customer email in subscription payload');
          return res.status(400).json({ error: 'Missing customer email' });
        }

        const userId = await findUserByEmail(userEmail);
        if (!userId) {
          logger.error(`User not found for email: ${userEmail}`);
          return res.status(404).json({ error: 'User not found' });
        }

        // ✅ FIX: Update subscription status to canceled
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('external_payment_id', subscription.id);

        if (subscriptionError) {
          logger.error('Error canceling subscription:', subscriptionError);
          return res.status(500).json({ error: 'Failed to cancel subscription' });
        }

        // ✅ FIX: Downgrade user's plan to 'free' when subscription is canceled
        // Find the free plan (try common names: 'free', 'hobbyist', or look for plan with lowest price)
        // profiles.plan_id is text, so we can use slug/name or UUID as string
        let freePlanId = 'free'; // Default fallback (text)
        const { data: freePlan, error: freePlanError } = await supabase
          .from('plans')
          .select('id, name, slug')
          .or('name.eq.free,name.eq.Free,name.eq.hobbyist,name.eq.Hobbyist,slug.eq.free,slug.eq.hobbyist')
          .order('price_cents', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!freePlanError && freePlan) {
          // ✅ FIX: Use slug/name for profiles.plan_id (text field), UUID for subscriptions (if needed)
          freePlanId = freePlan.slug || freePlan.name || freePlan.id.toString();
        }
        // If not found, use 'free' as fallback (planService will handle it)

        // Update user's profile to downgrade plan
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            plan_id: freePlanId, // Text field - use slug/name
            plan_changed_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileError) {
          logger.error('Error downgrading user plan after cancellation:', profileError);
          // Don't fail the webhook - subscription was already canceled
        } else {
          logger.info(`User ${userId} downgraded to free plan after subscription cancellation`);
          
          // ✅ FIX: Send realtime notification to update frontend
          try {
            await supabase
              .channel('plan-notifications')
              .send({
                type: 'broadcast',
                event: 'plan_updated',
                payload: {
                  user_id: userId,
                  plan_id: freePlanId,
                  updated_at: new Date().toISOString(),
                  trigger: 'polar_webhook_cancellation'
                }
              });
          } catch (broadcastError) {
            logger.warn('Failed to send realtime notification for plan downgrade:', broadcastError);
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Subscription canceled for user ${userId}:`, {
            externalPaymentId: subscription.id,
            downgraded_to_plan: freePlanId
          });
        }

        return res.status(200).json({
          success: true,
          action: 'canceled',
          userId,
          downgraded_to_plan: freePlanId,
          duration_ms: Date.now() - startTime
        });
      }

      default:
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`Unhandled webhook type: ${payload.type}`);
        }
        return res.status(200).json({
          success: true,
          message: 'Webhook received but not processed',
          type: payload.type
        });
    }
  }

  } catch (error) {
    logger.error('Error processing Polar webhook:', error);
    return res.status(500).json({
      error: 'Internal server error',
      duration_ms: Date.now() - startTime
    });
  }
});

module.exports = router;