const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

router.post('/generate-referral', async (req, res) => {
  try {
    const { referrerEmail, referredEmail } = req.body;

    if (!referrerEmail || !referredEmail) {
      return res.status(400).json({ error: 'Both referrer and referred emails are required' });
    }

    if (referrerEmail === referredEmail) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // Get referrer user ID from profiles
    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', referrerEmail)
      .single();

    if (referrerError || !referrerProfile) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // Check if referred email already has an account
    const { data: existingUser, error: existingError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', referredEmail)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already has an account' });
    }

    // Check if this referral already exists and is pending
    const { data: existingReferral, error: existingReferralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('owner_user_id', referrerProfile.id)
      .eq('metadata->>referred_email', referredEmail)
      .eq('status', 'pending')
      .single();

    if (existingReferral) {
      return res.status(400).json({ error: 'Referral already sent to this email' });
    }

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      referralCode = generateReferralCode();
      const { data: existingCode } = await supabase
        .from('referrals')
        .select('id')
        .eq('code', referralCode)
        .single();

      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique referral code' });
    }

    // Create referral record
    const { data: referral, error: referralInsertError } = await supabase
      .from('referrals')
      .insert({
        code: referralCode,
        owner_user_id: referrerProfile.id,
        referral_code: referralCode,
        status: 'pending',
        metadata: {
          referred_email: referredEmail,
          referrer_email: referrerEmail,
          sent_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (referralInsertError) {
      console.error('Error creating referral:', referralInsertError);
      return res.status(500).json({ error: 'Failed to create referral' });
    }

    // TODO: Send email to referred user with signup link containing referral code
    console.log(`Referral created: ${referralCode} for ${referredEmail} by ${referrerEmail}`);

    res.json({
      success: true,
      referralCode,
      message: 'Referral sent successfully!'
    });

  } catch (error) {
    console.error('Error in generate-referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/complete-referral', async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;

    if (!referralCode || !newUserId) {
      return res.status(400).json({ error: 'Referral code and user ID are required' });
    }

    // Find the referral
    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('*')
      .eq('code', referralCode)
      .eq('status', 'pending')
      .single();

    if (referralError || !referral) {
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    // Update referral as completed
    const { error: updateError } = await supabase
      .from('referrals')
      .update({
        redeemed_by_user_id: newUserId,
        referred_user_id: newUserId,
        redeemed_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', referral.id);

    if (updateError) {
      console.error('Error updating referral:', updateError);
      return res.status(500).json({ error: 'Failed to complete referral' });
    }

    // Grant reward to referrer (1 month free)
    await grantReferralReward(referral.owner_user_id);

    res.json({
      success: true,
      message: 'Referral completed successfully!'
    });

  } catch (error) {
    console.error('Error in complete-referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function grantReferralReward(userId) {
  try {
    // Get user's current plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan, plan_expires_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile for reward:', profileError);
      return;
    }

    // Calculate new expiration date (extend by 1 month)
    let newExpirationDate;
    const currentExpiration = profile.plan_expires_at ? new Date(profile.plan_expires_at) : new Date();
    
    // If plan already expired or expiring soon, start from now
    if (currentExpiration <= new Date()) {
      newExpirationDate = new Date();
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 1);
    } else {
      // Extend current expiration by 1 month
      newExpirationDate = new Date(currentExpiration);
      newExpirationDate.setMonth(newExpirationDate.getMonth() + 1);
    }

    // Update user's plan expiration
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plan_expires_at: newExpirationDate.toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error granting referral reward:', updateError);
    } else {
      console.log(`Granted 1 month free to user ${userId}, plan expires: ${newExpirationDate}`);
    }

    // Mark reward as granted
    await supabase
      .from('referrals')
      .update({ reward_granted: true })
      .eq('owner_user_id', userId)
      .eq('status', 'completed')
      .eq('reward_granted', false);

  } catch (error) {
    console.error('Error in grantReferralReward:', error);
  }
}

router.get('/referrals/health', (_req, res) => {
  res.json({ ok: true });
});

module.exports = { router };
