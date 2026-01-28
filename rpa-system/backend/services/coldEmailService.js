/**
 * Cold Email Service
 *
 * Integrates with cold email platforms:
 * - Instantly API
 * - Smartlead API
 *
 * Features:
 * - Campaign creation
 * - Email sending
 * - Deliverability tracking
 * - Campaign-ready export format
 */

const { createLogger } = require('../middleware/structuredLogging');
const axios = require('axios');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('service.coldEmail');

class ColdEmailService {
 constructor() {
 this.instantlyApiKey = process.env.INSTANTLY_API_KEY || '';
 this.instantlyApiUrl = 'https://api.instantly.ai/api/v1';
 this.smartleadApiKey = process.env.SMARTLEAD_API_KEY || '';
 this.smartleadApiUrl = 'https://server.smartlead.ai/api/v1';
 }

 /**
 * Create campaign in Instantly
 */
 async createInstantlyCampaign(campaignData) {
 if (!this.instantlyApiKey) {
 return { success: false, error: 'Instantly API key not configured' };
 }

 try {
 const response = await axios.post(
 `${this.instantlyApiUrl}/campaign/create`,
 {
 name: campaignData.name,
 from_name: campaignData.fromName || 'EasyFlow',
 from_email: campaignData.fromEmail,
 reply_to: campaignData.replyTo || campaignData.fromEmail,
 subject: campaignData.subject,
 html_content: campaignData.htmlContent,
 plain_text_content: campaignData.plainTextContent,
 email_account_id: campaignData.emailAccountId,
 settings: {
 daily_limit: campaignData.dailyLimit || 50,
 auto_warmup_enabled: campaignData.autoWarmup || false,
 track_opens: campaignData.trackOpens !== false,
 track_clicks: campaignData.trackClicks !== false
 }
 },
 {
 headers: {
 'Authorization': `Bearer ${this.instantlyApiKey}`,
 'Content-Type': 'application/json'
 },
 timeout: 30000
 }
 );

 return {
 success: true,
 campaignId: response.data?.campaign_id,
 data: response.data
 };
 } catch (error) {
 logger.error('Failed to create Instantly campaign', error, { campaignName: campaignData.name });
 return {
 success: false,
 error: error.response?.data?.message || error.message
 };
 }
 }

 /**
 * Add leads to Instantly campaign
 */
 async addLeadsToInstantlyCampaign(campaignId, leads) {
 if (!this.instantlyApiKey) {
 return { success: false, error: 'Instantly API key not configured' };
 }

 try {
 const leadData = leads.map(lead => ({
 email: lead.email,
 first_name: lead.firstName || '',
 last_name: lead.lastName || '',
 company_name: lead.companyName || '',
 personalization: lead.personalization || {}
 }));

 const response = await axios.post(
 `${this.instantlyApiUrl}/lead/add`,
 {
 campaign_id: campaignId,
 leads: leadData
 },
 {
 headers: {
 'Authorization': `Bearer ${this.instantlyApiKey}`,
 'Content-Type': 'application/json'
 },
 timeout: 30000
 }
 );

 return {
 success: true,
 added: response.data?.added || leadData.length,
 data: response.data
 };
 } catch (error) {
 logger.error('Failed to add leads to Instantly campaign', error, { campaignId });
 return {
 success: false,
 error: error.response?.data?.message || error.message
 };
 }
 }

 /**
 * Create campaign in Smartlead
 */
 async createSmartleadCampaign(campaignData) {
 if (!this.smartleadApiKey) {
 return { success: false, error: 'Smartlead API key not configured' };
 }

 try {
 const response = await axios.post(
 `${this.smartleadApiUrl}/campaign/create`,
 {
 name: campaignData.name,
 from_name: campaignData.fromName || 'EasyFlow',
 from_email: campaignData.fromEmail,
 reply_to: campaignData.replyTo || campaignData.fromEmail,
 subject: campaignData.subject,
 body_html: campaignData.htmlContent,
 body_text: campaignData.plainTextContent,
 email_account_id: campaignData.emailAccountId,
 daily_limit: campaignData.dailyLimit || 50
 },
 {
 headers: {
 'X-API-KEY': this.smartleadApiKey,
 'Content-Type': 'application/json'
 },
 timeout: 30000
 }
 );

 return {
 success: true,
 campaignId: response.data?.campaign_id,
 data: response.data
 };
 } catch (error) {
 logger.error('Failed to create Smartlead campaign', error, { campaignName: campaignData.name });
 return {
 success: false,
 error: error.response?.data?.message || error.message
 };
 }
 }

 /**
 * Add leads to Smartlead campaign
 */
 async addLeadsToSmartleadCampaign(campaignId, leads) {
 if (!this.smartleadApiKey) {
 return { success: false, error: 'Smartlead API key not configured' };
 }

 try {
 const leadData = leads.map(lead => ({
 email: lead.email,
 first_name: lead.firstName || '',
 last_name: lead.lastName || '',
 company: lead.companyName || '',
 custom_variables: lead.personalization || {}
 }));

 const response = await axios.post(
 `${this.smartleadApiUrl}/leads/add`,
 {
 campaign_id: campaignId,
 leads: leadData
 },
 {
 headers: {
 'X-API-KEY': this.smartleadApiKey,
 'Content-Type': 'application/json'
 },
 timeout: 30000
 }
 );

 return {
 success: true,
 added: response.data?.added || leadData.length,
 data: response.data
 };
 } catch (error) {
 logger.error('Failed to add leads to Smartlead campaign', error, { campaignId });
 return {
 success: false,
 error: error.response?.data?.message || error.message
 };
 }
 }

 /**
 * Get campaign statistics
 */
 async getCampaignStats(platform, campaignId) {
 try {
 if (platform === 'instantly' && this.instantlyApiKey) {
 const response = await axios.get(
 `${this.instantlyApiUrl}/campaign/stats`,
 {
 params: { campaign_id: campaignId },
 headers: {
 'Authorization': `Bearer ${this.instantlyApiKey}`
 },
 timeout: 10000
 }
 );

 return {
 success: true,
 stats: {
 sent: response.data?.sent || 0,
 delivered: response.data?.delivered || 0,
 opened: response.data?.opened || 0,
 clicked: response.data?.clicked || 0,
 replied: response.data?.replied || 0,
 bounced: response.data?.bounced || 0
 }
 };
 }

 if (platform === 'smartlead' && this.smartleadApiKey) {
 const response = await axios.get(
 `${this.smartleadApiUrl}/campaign/stats`,
 {
 params: { campaign_id: campaignId },
 headers: {
 'X-API-KEY': this.smartleadApiKey
 },
 timeout: 10000
 }
 );

 return {
 success: true,
 stats: response.data
 };
 }

 return { success: false, error: 'Platform not configured' };
 } catch (error) {
 logger.error('Failed to get campaign stats', error, { platform, campaignId });
 return {
 success: false,
 error: error.message
 };
 }
 }

 /**
 * Export leads in campaign-ready format (CSV)
 */
 exportLeadsToCSV(leads) {
 const headers = ['email', 'first_name', 'last_name', 'company_name', 'title', 'linkedin', 'personalization'];
 const rows = leads.map(lead => [
 lead.email || '',
 lead.firstName || '',
 lead.lastName || '',
 lead.companyName || '',
 lead.title || '',
 lead.linkedin || '',
 JSON.stringify(lead.personalization || {})
 ]);

 const csv = [
 headers.join(','),
 ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
 ].join('\n');

 return csv;
 }

 /**
 * Export leads in JSON format
 */
 exportLeadsToJSON(leads) {
 return JSON.stringify(leads.map(lead => ({
 email: lead.email,
 first_name: lead.firstName,
 last_name: lead.lastName,
 company_name: lead.companyName,
 title: lead.title,
 linkedin: lead.linkedin,
 personalization: lead.personalization || {}
 })), null, 2);
 }

 /**
 * Save campaign to database
 */
 async saveCampaign(campaignData, userId) {
 try {
 const supabase = getSupabase();
 if (!supabase) {
 logger.warn('Database not available, skipping campaign save');
 return { success: false, error: 'Database not available' };
 }

 // Note: This would require a campaigns table in the database
 // For now, we'll just log it
 logger.info('Campaign created', {
 name: campaignData.name,
 platform: campaignData.platform,
 userId
 });

 return { success: true };
 } catch (error) {
 logger.error('Failed to save campaign', error);
 return { success: false, error: error.message };
 }
 }
}

// Singleton instance
let coldEmailInstance = null;

function getColdEmailService() {
 if (!coldEmailInstance) {
 coldEmailInstance = new ColdEmailService();
 }
 return coldEmailInstance;
}

module.exports = {
 ColdEmailService,
 getColdEmailService
};

