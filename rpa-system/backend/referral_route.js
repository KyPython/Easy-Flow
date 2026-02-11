
const { logger, getLogger } = require('./utils/logger');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();
const { getReferralInviteEmail } = require('./utils/emailTemplates');

// Initialize SendGrid for email sending
let sgMail;
try {
 sgMail = require('@sendgrid/mail');
} catch (e) {
 // Provide a minimal stub so the module can be required without crashing
 sgMail = {
 setApiKey: () => {},
 send: async () => { throw new Error('SendGrid client not installed'); }
 };
}

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || '';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'EasyFlow';

// Configure SendGrid if available
if (SENDGRID_API_KEY) {
 try { sgMail.setApiKey(SENDGRID_API_KEY); } catch (_e) { /* ignore */ }
}

// Build FROM address with optional name
const getFromAddress = () => {
 if (!SENDGRID_FROM_EMAIL) return '';
 if (SENDGRID_FROM_NAME && SENDGRID_FROM_NAME !== 'EasyFlow') {
 return `${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`;
 }
 return SENDGRID_FROM_EMAIL;
};

// Initialize Supabase client only when needed to avoid env var issues at startup
function getSupabaseClient() {
 if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
 throw new Error('Supabase environment variables not configured');
 }
 return createClient(
 process.env.SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY
 );
}

function generateReferralCode() {
 return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Send referral invitation email to the referred user
 */
async function sendReferralEmail(toEmail, referralCode, referrerName, referrerEmailAddr) {
 try {
 // Check if email service is configured
 if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
 logger.warn('[referral_route] Email service not configured - referral email not sent', {
 to_email: toEmail,
 referral_code: referralCode
 });
 return { success: false, error: 'Email not configured' };
 }

 // Generate email content using template
 const emailTemplate = getReferralInviteEmail({
 referralCode,
 referrerName: referrerName || 'A friend',
 referrerEmail: referrerEmailAddr
 });

 const msg = {
 to: toEmail,
 from: getFromAddress(),
 subject: emailTemplate.subject,
 text: emailTemplate.text,
 html: emailTemplate.html
 };

 const [result] = await sgMail.send(msg);
 logger.info(`[referral_route] Referral email sent to ${toEmail}`, {
 message_id: result?.headers?.['x-message-id'],
 referral_code: referralCode
 });

 return { success: true, messageId: result?.headers?.['x-message-id'] };
 } catch (error) {
 const errorMsg = error?.response?.body?.errors?.map(err => err.message).join('; ') || error?.message || 'Failed to send email';
 logger.error('[referral_route] Failed to send referral email', {
 error: errorMsg,
 to_email: toEmail,
 referral_code: referralCode
 });
 return { success: false, error: errorMsg };
 }
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

 const supabase = getSupabaseClient();

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
 logger.error('Error creating referral:', referralInsertError);
 return res.status(500).json({ error: 'Failed to create referral' });
 }

 // Send referral invitation email
 const emailResult = await sendReferralEmail(referredEmail, referralCode, referrerEmail, referrerEmail);

 if (!emailResult.success) {
 logger.warn(`[referral_route] Referral created but email failed to send: ${emailResult.error}`);
 }

 logger.info(`Referral created: ${referralCode} for ${referredEmail} by ${referrerEmail}`);

 res.json({
 success: true,
 referralCode,
 message: 'Referral sent successfully!'
 });

 } catch (error) {
 logger.error('Error in generate-referral:', error);
 res.status(500).json({ error: 'Internal server error' });
 }
});

router.post('/complete-referral', async (req, res) => {
 try {
 const { referralCode, newUserId } = req.body;

 if (!referralCode || !newUserId) {
 return res.status(400).json({ error: 'Referral code and user ID are required' });
 }

 const supabase = getSupabaseClient();

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
 logger.error('Error updating referral:', updateError);
 return res.status(500).json({ error: 'Failed to complete referral' });
 }

 // Grant reward to referrer (1 month free)
 await grantReferralReward(referral.owner_user_id);

 res.json({
 success: true,
 message: 'Referral completed successfully!'
 });

 } catch (error) {
 logger.error('Error in complete-referral:', error);
 res.status(500).json({ error: 'Internal server error' });
 }
});

async function grantReferralReward(userId) {
 try {
 const supabase = getSupabaseClient();

 // Get user's current plan
 const { data: profile, error: profileError } = await supabase
 .from('profiles')
 .select('subscription_plan, plan_expires_at')
 .eq('id', userId)
 .single();

 if (profileError) {
 logger.error('Error fetching user profile for reward:', profileError);
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
 logger.error('Error granting referral reward:', updateError);
 } else {
 logger.info(`Granted 1 month free to user ${userId}, plan expires: ${newExpirationDate}`);
 }

 // Mark reward as granted
 await supabase
 .from('referrals')
 .update({ reward_granted: true })
 .eq('owner_user_id', userId)
 .eq('status', 'completed')
 .eq('reward_granted', false);

 } catch (error) {
 logger.error('Error in grantReferralReward:', error);
 }
}

router.get('/referrals/health', (_req, res) => {
 res.json({ ok: true });
});

module.exports = { router };
