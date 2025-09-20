const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const requireFeature = require('../middleware/planEnforcement');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
);

function verifyPolarWebhook(rawBody, signature, secret) {
  if (!secret || !signature) {
    console.warn('Missing webhook secret or signature');
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
      console.error('Error finding user by email:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Error in findUserByEmail:', err);
    return null;
  }
}

async function findPlanByPolarProductId(polarProductId) {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('id')
      .eq('external_product_id', polarProductId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error finding plan by polar product ID:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Error in findPlanByPolarProductId:', err);
    return null;
  }
}

async function updateUserSubscription(userId, planId, externalPaymentId, status = 'active', subscription = null) {
  try {
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing subscription:', fetchError);
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
        console.error('Error updating subscription:', updateError);
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
        console.error('Error creating subscription:', insertError);
        return false;
      }
      subscriptionResult = { action: 'created' };
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        plan_id: planId,
        plan_changed_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile plan:', profileError);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Profile plan updated for user ${userId} to plan ${planId}`);
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
        console.warn('Failed to send realtime notification:', broadcastError);
      }
    }

    return subscriptionResult;
  } catch (err) {
    console.error('Error in updateUserSubscription:', err);
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
      console.warn('POLAR_WEBHOOK_SECRET not configured - webhook verification disabled');
      // In production, require webhook secret. In dev, allow without verification for testing.
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }
    }

    // Only verify signature if webhook secret is configured
    if (webhookSecret && !verifyPolarWebhook(req.body, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(req.body.toString());
    if (process.env.NODE_ENV !== 'production') {
      console.log('Received Polar webhook:', {
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
          console.error('No customer email in subscription payload');
          return res.status(400).json({ error: 'Missing customer email' });
        }

        const userId = await findUserByEmail(userEmail);
        if (!userId) {
          console.error(`User not found for email: ${userEmail}`);
          return res.status(404).json({ error: 'User not found' });
        }

        const planId = await findPlanByPolarProductId(subscription.product_id);
        if (!planId) {
          console.error(`Plan not found for Polar product ID: ${subscription.product_id}`);
          return res.status(404).json({ error: 'Plan not found' });
        }

        const result = await updateUserSubscription(
          userId,
          planId,
          subscription.id,
          subscription.status
        );

        if (!result) {
          return res.status(500).json({ error: 'Failed to update subscription' });
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Subscription ${result.action} for user ${userId}:`, {
          planId,
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
          console.error('No customer email in subscription payload');
          return res.status(400).json({ error: 'Missing customer email' });
        }

        const userId = await findUserByEmail(userEmail);
        if (!userId) {
          console.error(`User not found for email: ${userEmail}`);
          return res.status(404).json({ error: 'User not found' });
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('external_payment_id', subscription.id);

        if (error) {
          console.error('Error canceling subscription:', error);
          return res.status(500).json({ error: 'Failed to cancel subscription' });
        }

        if (process.env.NODE_ENV !== 'production') {
	  console.log(`Subscription canceled for user ${userId}:`, {
            externalPaymentId: subscription.id
          });
        }

        return res.status(200).json({
          success: true,
          action: 'canceled',
          userId,
          duration_ms: Date.now() - startTime
        });
      }

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Unhandled webhook type: ${payload.type}`);
        }
        return res.status(200).json({
          success: true,
          message: 'Webhook received but not processed',
          type: payload.type
        });
    }
  }

  } catch (error) {
    console.error('Error processing Polar webhook:', error);
    return res.status(500).json({
      error: 'Internal server error',
      duration_ms: Date.now() - startTime
    });
  }
});

module.exports = router;