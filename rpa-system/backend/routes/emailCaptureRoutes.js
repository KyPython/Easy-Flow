const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { getAutomationTipsEmail } = require('../utils/emailTemplates');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseServiceKey ?
 createClient(supabaseUrl, supabaseServiceKey) :
 null;

/**
 * POST /api/capture-email
 * Captures email addresses for lead nurturing
 */
router.post('/capture-email', async (req, res) => {
 try {
 const { email, source, sessionCount, userPlan, timestamp } = req.body;

 // Validate email
 if (!email || typeof email !== 'string') {
 return res.status(400).json({
 error: 'Email is required',
 message: 'Please provide a valid email address'
 });
 }

 // Basic email validation
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 if (!emailRegex.test(email)) {
 return res.status(400).json({
 error: 'Invalid email format',
 message: 'Please enter a valid email address'
 });
 }

 // ✅ SECURITY: Validate type before using string methods
 const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : String(email || '').toLowerCase().trim();
 logger.info('📧 Capturing email:', { email: normalizedEmail, source, sessionCount, userPlan });

 // 1. Save to Supabase if configured
 if (supabase) {
 try {
 const { error: insertError } = await supabase
 .from('email_captures')
 .insert({
 email: normalizedEmail,
 source: source || 'unknown',
 session_count: sessionCount || 0,
 user_plan: userPlan || 'hobbyist',
 captured_at: timestamp || new Date().toISOString(),
 created_at: new Date().toISOString()
 });

 if (insertError) {
 logger.error('❌ Error saving email to Supabase:', insertError);
 // Don't fail the request if Supabase insert fails
 } else {
 logger.info('✅ Email saved to Supabase successfully');
 }
 } catch (dbError) {
 logger.error('❌ Database error saving email:', dbError);
 // Continue even if database save fails
 }
 } else {
 logger.warn('⚠️ Supabase not configured - email not persisted');
 }

 // 2. Send automation tips email immediately (or enqueue if SendGrid not configured)
 const emailTemplate = getAutomationTipsEmail({ email: normalizedEmail, source, userPlan });

 // Try to send directly via SendGrid if configured
 const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
 const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL;
 const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'EasyFlow';

 // Build FROM address with optional name: "Name <email@domain.com>" or just "email@domain.com"
 const getFromAddress = () => {
 if (!SENDGRID_FROM_EMAIL) return '';
 if (SENDGRID_FROM_NAME && SENDGRID_FROM_NAME !== 'EasyFlow') {
 return `${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`;
 }
 return SENDGRID_FROM_EMAIL;
 };

 if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
 // Send email directly via SendGrid
 try {
 let sgMail;
 try {
 sgMail = require('@sendgrid/mail');
 sgMail.setApiKey(SENDGRID_API_KEY);
 } catch (sgError) {
 logger.warn('⚠️ SendGrid not available, will enqueue email instead');
 throw sgError;
 }

 const msg = {
 to: normalizedEmail,
 from: getFromAddress(), // Supports "Name <email@domain.com>" format
 subject: emailTemplate.subject,
 text: emailTemplate.text,
 html: emailTemplate.html,
 // Add tracking info for HubSpot
 customArgs: {
 source: source || 'session_modal',
 userPlan: userPlan || 'hobbyist',
 campaign: 'automation_tips'
 }
 };

 const [result] = await sgMail.send(msg);
 logger.info(`✅ Automation tips email sent directly to ${normalizedEmail}. Message ID: ${result?.headers?.['x-message-id'] || 'unknown'}`);
 } catch (sendError) {
 logger.error('❌ Error sending email directly:', sendError.message);
 // Fall back to email queue
 if (supabase) {
 try {
 const now = new Date();
 const { error: emailQueueError } = await supabase
 .from('email_queue')
 .insert({
 to_email: normalizedEmail,
 template: 'automation_tips',
 data: {
 source: source || 'session_modal',
 sessionCount: sessionCount || 0,
 userPlan: userPlan || 'hobbyist',
 subject: emailTemplate.subject,
 html: emailTemplate.html,
 text: emailTemplate.text
 },
 scheduled_at: now.toISOString(),
 status: 'pending',
 created_at: now.toISOString()
 });

 if (emailQueueError) {
 logger.error('❌ Error enqueueing email:', emailQueueError);
 } else {
 logger.info('✅ Automation tips email enqueued as fallback');
 }
 } catch (emailError) {
 logger.error('❌ Error preparing email for queue:', emailError);
 }
 }
 }
 } else if (supabase) {
 // SendGrid not configured, enqueue for email worker
 try {
 const now = new Date();
 const { error: emailQueueError } = await supabase
 .from('email_queue')
 .insert({
 to_email: normalizedEmail,
 template: 'automation_tips',
 data: {
 source: source || 'session_modal',
 sessionCount: sessionCount || 0,
 userPlan: userPlan || 'hobbyist',
 subject: emailTemplate.subject,
 html: emailTemplate.html,
 text: emailTemplate.text
 },
 scheduled_at: now.toISOString(),
 status: 'pending',
 created_at: now.toISOString()
 });

 if (emailQueueError) {
 logger.error('❌ Error enqueueing email:', emailQueueError);
 } else {
 logger.info('✅ Automation tips email enqueued successfully');
 }
 } catch (emailError) {
 logger.error('❌ Error preparing email:', emailError);
 // Continue even if email enqueue fails
 }
 } else {
 logger.warn('⚠️ Neither SendGrid nor email queue configured - email will not be sent');
 }

 // 3. Add to HubSpot (fire-and-forget, don't block response)
 if (process.env.HUBSPOT_API_KEY && process.env.NODE_ENV !== 'test') {
 (async () => {
 try {
 const firstName = normalizedEmail.split('@')[0];
 const hubspotPayload = {
 properties: {
 email: normalizedEmail,
 firstname: firstName,
 lifecyclestage: 'lead',
 hs_lead_status: 'NEW',
 lead_source: 'Email Capture Modal',
 record_source: 'EasyFlow SaaS',
 signup_source: source || 'session_modal',
 user_plan: userPlan || 'hobbyist',
 session_count: sessionCount || 0,
 received_content: 'Automation Tips Email',
 signup_date: new Date().toISOString(),
 // Custom properties for tracking
 easyflow_source: source || 'session_modal',
 easyflow_user_plan: userPlan || 'hobbyist',
 easyflow_campaign: 'automation_tips'
 }
 };

 logger.info(`📊 Creating contact in HubSpot: ${normalizedEmail}`, { source, userPlan });

 const hubspotRes = await axios.post(
 'https://api.hubapi.com/crm/v3/objects/contacts',
 hubspotPayload,
 {
 headers: {
 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
 'Content-Type': 'application/json'
 },
 timeout: 10000
 }
 );

 logger.info(`✅ Successfully created contact ${normalizedEmail} in HubSpot. Contact ID: ${hubspotRes.data?.id}`);

 } catch (hubspotError) {
 // If contact already exists (409), update them instead
 if (hubspotError.response?.status === 409) {
 try {
 const message = hubspotError.response.data?.message || '';
 const contactIdMatch = message.match(/Existing contact id: (\d+)/);
 const contactId = contactIdMatch ? contactIdMatch[1] : null;

 if (contactId) {
 const updatePayload = {
 properties: {
 lifecyclestage: 'lead',
 hs_lead_status: 'NEW',
 lead_source: 'Email Capture Modal',
 record_source: 'EasyFlow SaaS',
 signup_source: source || 'session_modal',
 user_plan: userPlan || 'hobbyist',
 received_content: 'Automation Tips Email',
 easyflow_source: source || 'session_modal',
 easyflow_user_plan: userPlan || 'hobbyist',
 easyflow_campaign: 'automation_tips',
 last_contact_date: new Date().toISOString()
 }
 };

 logger.info(`📊 Updating existing contact in HubSpot: ${contactId}`);

 await axios.patch(
 `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
 updatePayload,
 {
 headers: {
 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
 'Content-Type': 'application/json'
 },
 timeout: 10000
 }
 );

 logger.info(`✅ Successfully updated contact ${normalizedEmail} in HubSpot`);
 } else {
 logger.warn(`⚠️ Failed to parse contact ID from HubSpot error: ${message}`);
 }
 } catch (updateError) {
 logger.error(`❌ Failed to update contact ${normalizedEmail} in HubSpot:`, updateError.message);
 }
 } else {
 logger.error(`❌ Failed to create contact ${normalizedEmail} in HubSpot:`, {
 status: hubspotError.response?.status,
 message: hubspotError.message,
 data: hubspotError.response?.data
 });
 }
 }
 })();
 } else {
 logger.warn('⚠️ HubSpot API key not configured - contact not added to HubSpot');
 }

 // Always return success to avoid breaking the UI
 res.status(200).json({
 success: true,
 message: 'Email captured successfully. Check your inbox for automation tips!'
 });

 } catch (error) {
 logger.error('❌ Error in email capture endpoint:', error);

 // Return success even on error to avoid breaking user experience
 // Log the error for monitoring
 res.status(200).json({
 success: true,
 message: 'Email captured successfully',
 warning: 'Email may not have been persisted'
 });
 }
});

/**
 * GET /api/unsubscribe
 * Handles email unsubscribe requests
 */
router.get('/unsubscribe', async (req, res) => {
 try {
 const { email, token } = req.query;

 if (!email) {
 return res.status(400).send(`
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Unsubscribe - EasyFlow</title>
 <style>
 body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
 .error { color: #dc2626; background: #fef2f2; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; }
 </style>
 </head>
 <body>
 <h1>Unsubscribe from EasyFlow</h1>
 <div class="error">
 <p><strong>Error:</strong> Email address is required.</p>
 <p>Please use the unsubscribe link from your email.</p>
 </div>
 </body>
 </html>
 `);
 }

 // ✅ SECURITY: Validate type before using string methods
 const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : String(email || '').toLowerCase().trim();
 logger.info('📧 Unsubscribe request:', { email: normalizedEmail });

 // Mark email as unsubscribed in Supabase
 if (supabase) {
 try {
 // Update email_captures table
 const { error: updateError } = await supabase
 .from('email_captures')
 .update({
 unsubscribed: true,
 unsubscribed_at: new Date().toISOString()
 })
 .eq('email', normalizedEmail);

 if (updateError) {
 logger.error('❌ Error updating unsubscribe status:', updateError);
 } else {
 logger.info(`✅ Email ${normalizedEmail} unsubscribed successfully`);
 }

 // Also update HubSpot if configured
 if (process.env.HUBSPOT_API_KEY) {
 try {
 // Find contact by email
 const hubspotRes = await axios.get(
 `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(normalizedEmail)}?idProperty=email`,
 {
 headers: {
 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
 'Content-Type': 'application/json'
 },
 timeout: 10000
 }
 ).catch(() => null);

 if (hubspotRes?.data?.id) {
 await axios.patch(
 `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotRes.data.id}`,
 {
 properties: {
 hs_email_optout: true,
 unsubscribed: true,
 unsubscribed_date: new Date().toISOString()
 }
 },
 {
 headers: {
 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
 'Content-Type': 'application/json'
 },
 timeout: 10000
 }
 );
 logger.info(`✅ Updated HubSpot contact ${normalizedEmail} as unsubscribed`);
 }
 } catch (hubspotError) {
 logger.warn('⚠️ Could not update HubSpot unsubscribe status:', hubspotError.message);
 // Don't fail the request if HubSpot update fails
 }
 }
 } catch (dbError) {
 logger.error('❌ Database error updating unsubscribe:', dbError);
 // Continue to show success page even if DB update fails
 }
 }

 // Return success page
 const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || 'https://www.tryeasyflow.com';

 res.status(200).send(`
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Unsubscribed - EasyFlow</title>
 <style>
 body { 
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
 max-width: 600px; 
 margin: 50px auto; 
 padding: 20px; 
 background-color: #f5f5f5;
 }
 .container {
 background: white;
 padding: 40px;
 border-radius: 8px;
 box-shadow: 0 2px 4px rgba(0,0,0,0.1);
 text-align: center;
 }
 .success-icon {
 font-size: 48px;
 margin-bottom: 20px;
 }
 h1 { color: #1f2937; margin-bottom: 10px; }
 p { color: #4b5563; line-height: 1.6; }
 .button {
 display: inline-block;
 margin-top: 20px;
 padding: 12px 24px;
 background-color: #2563eb;
 color: white;
 text-decoration: none;
 border-radius: 6px;
 font-weight: 600;
 }
 .button:hover {
 background-color: #1d4ed8;
 }
 </style>
 </head>
 <body>
 <div class="container">
 <div class="success-icon">✅</div>
 <h1>You've been unsubscribed</h1>
 <p>We're sorry to see you go! You've been successfully unsubscribed from EasyFlow automation tips emails.</p>
 <p>You won't receive any more marketing emails from us.</p>
 <a href="${appUrl}" class="button">Visit EasyFlow</a>
 </div>
 </body>
 </html>
 `);

 } catch (error) {
 logger.error('❌ Error in unsubscribe endpoint:', error);

 res.status(500).send(`
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>Error - EasyFlow</title>
 <style>
 body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
 .error { color: #dc2626; background: #fef2f2; padding: 15px; border-radius: 6px; }
 </style>
 </head>
 <body>
 <h1>Unsubscribe Error</h1>
 <div class="error">
 <p>An error occurred while processing your unsubscribe request.</p>
 <p>Please try again later or contact support if the issue persists.</p>
 </div>
 </body>
 </html>
 `);
 }
});

module.exports = router;

