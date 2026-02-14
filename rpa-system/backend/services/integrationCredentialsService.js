/**
 * Integration Credentials Service
 * Manages encrypted storage and retrieval of OAuth tokens and API keys
 */

const { getSupabase } = require('../utils/supabaseClient');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

class IntegrationCredentialsService {
 constructor() {
 this.supabase = getSupabase();
 }

 /**
 * Encrypt credentials before storing
 * @private
 */
 _encrypt(plaintext) {
 const iv = crypto.randomBytes(16);
 const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'); // Use first 32 bytes

 const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
 let encrypted = cipher.update(JSON.stringify(plaintext), 'utf8', 'hex');
 encrypted += cipher.final('hex');

 const authTag = cipher.getAuthTag();

 return {
 encrypted: encrypted,
 iv: iv.toString('hex'),
 authTag: authTag.toString('hex')
 };
 }

 /**
 * Decrypt credentials after retrieval
 * @private
 */
 _decrypt(encryptedData) {
 const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
 const iv = Buffer.from(encryptedData.iv, 'hex');
 const authTag = Buffer.from(encryptedData.authTag, 'hex');

 const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
 decipher.setAuthTag(authTag);

 let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
 decrypted += decipher.final('utf8');

 return JSON.parse(decrypted);
 }

 /**
 * Store integration credentials
 * @param {String} userId - User ID
 * @param {String} service - Service name (slack, gmail, etc.)
 * @param {Object} credentials - Credentials to encrypt and store
 * @param {Object} options - { displayName?, expiresAt? }
 */
 async storeCredentials(userId, service, credentials, options = {}) {
 const { displayName = null, expiresAt = null } = options;

 // Encrypt credentials
 const encrypted = this._encrypt(credentials);

 // Check if credentials already exist
 const { data: existing } = await this.supabase
 .from('integration_credentials')
 .select('id')
 .eq('user_id', userId)
 .eq('service', service)
 .maybeSingle();

 const data = {
 user_id: userId,
 service,
 display_name: displayName,
 credentials_encrypted: encrypted,
 expires_at: expiresAt,
 is_active: true,
 updated_at: new Date().toISOString()
 };

 let result;
 if (existing) {
 // Update existing
 result = await this.supabase
 .from('integration_credentials')
 .update(data)
 .eq('id', existing.id)
 .select()
 .single();
 } else {
 // Create new
 result = await this.supabase
 .from('integration_credentials')
 .insert(data)
 .select()
 .single();
 }

 if (result.error) {
 logger.error('[IntegrationCredentials] Failed to store credentials:', result.error);
 throw new Error(`Failed to store credentials: ${result.error.message}`);
 }

 return result.data;
 }

 /**
 * Retrieve and decrypt integration credentials
 * @param {String} userId - User ID
 * @param {String} service - Service name
 */
 async getCredentials(userId, service) {
 const { data, error } = await this.supabase
 .from('integration_credentials')
 .select('*')
 .eq('user_id', userId)
 .eq('service', service)
 .eq('is_active', true)
 .maybeSingle();

 if (error) {
 logger.error('[IntegrationCredentials] Failed to retrieve credentials:', error);
 throw new Error(`Failed to retrieve credentials: ${error.message}`);
 }

 if (!data) {
 return null;
 }

 // Decrypt credentials
 const decrypted = this._decrypt(data.credentials_encrypted);

 return {
 id: data.id,
 service: data.service,
 displayName: data.display_name,
 credentials: decrypted,
 expiresAt: data.expires_at,
 lastUsedAt: data.last_used_at,
 lastTestedAt: data.last_tested_at,
 testStatus: data.test_status,
 createdAt: data.created_at,
 updatedAt: data.updated_at
 };
 }

 /**
 * List all integrations for a user
 * @param {String} userId - User ID
 */
 async listIntegrations(userId) {
 const { data, error } = await this.supabase
 .from('integration_credentials')
 .select('id, service, display_name, is_active, last_used_at, last_tested_at, test_status, created_at')
 .eq('user_id', userId)
 .order('created_at', { ascending: false });

 if (error) {
 logger.error('[IntegrationCredentials] Failed to list integrations:', error);
 throw new Error(`Failed to list integrations: ${error.message}`);
 }

 return data || [];
 }

 /**
 * Test integration connection
 * @param {String} userId - User ID
 * @param {String} service - Service name
 */
 async testConnection(userId, service) {
 const credentials = await this.getCredentials(userId, service);

 if (!credentials) {
 throw new Error(`No credentials found for ${service}`);
 }

 try {
 // Import the appropriate integration
 const IntegrationClass = this._getIntegrationClass(service);
 const integration = new IntegrationClass();

 // Test authentication
 await integration.authenticate(credentials.credentials);

 // Update test status
 await this.supabase
 .from('integration_credentials')
 .update({
 test_status: 'success',
 last_tested_at: new Date().toISOString()
 })
 .eq('id', credentials.id);

 return { success: true, message: `Connection to ${service} successful` };
 } catch (error) {
 // Update test status
 await this.supabase
 .from('integration_credentials')
 .update({
 test_status: 'failed',
 last_tested_at: new Date().toISOString()
 })
 .eq('id', credentials.id);

 logger.error(`[IntegrationCredentials] Connection test failed for ${service}:`, error);

 // Format error message to be more user-friendly
 let errorMessage = error.message;
 let actionUrl = null;
 let isConfigIssue = false;

 // Gmail API not enabled
 if (error.message?.includes('Gmail API has not been used') || error.message?.includes('Gmail API') && error.message?.includes('disabled')) {
 const projectIdMatch = error.message.match(/project (\d+)/);
 const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
 errorMessage = `Gmail API is not enabled in your Google Cloud project. Click the button below to enable it, wait a few minutes, then test again.`;
 actionUrl = `https://console.cloud.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId}`;
 isConfigIssue = true;
 }
 // Google Calendar API not enabled
 else if (error.message?.includes('Calendar') && (error.message?.includes('not been used') || error.message?.includes('disabled'))) {
 const projectIdMatch = error.message.match(/project (\d+)/);
 const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
 errorMessage = `Google Calendar API is not enabled in your Google Cloud project. Click the button below to enable it, wait a few minutes, then test again.`;
 actionUrl = `https://console.cloud.google.com/apis/api/calendar-json.googleapis.com/overview?project=${projectId}`;
 isConfigIssue = true;
 }
 // Google Sheets API not enabled
 else if (error.message?.includes('Sheets API') && (error.message?.includes('not been used') || error.message?.includes('disabled'))) {
 const projectIdMatch = error.message.match(/project (\d+)/);
 const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
 errorMessage = `Google Sheets API is not enabled in your Google Cloud project. Click the button below to enable it, wait a few minutes, then test again.`;
 actionUrl = `https://console.cloud.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`;
 isConfigIssue = true;
 }
 // Google Drive API not enabled
 else if (error.message?.includes('Drive API') && (error.message?.includes('not been used') || error.message?.includes('disabled'))) {
 const projectIdMatch = error.message.match(/project (\d+)/);
 const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
 errorMessage = `Google Drive API is not enabled in your Google Cloud project. Click the button below to enable it, wait a few minutes, then test again.`;
 actionUrl = `https://console.cloud.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`;
 isConfigIssue = true;
 }
 // Google Meet API not enabled
 else if (error.message?.includes('Meet API') && (error.message?.includes('not been used') || error.message?.includes('disabled'))) {
 const projectIdMatch = error.message.match(/project (\d+)/);
 const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
 errorMessage = `Google Meet API is not enabled in your Google Cloud project. Click the button below to enable it, wait a few minutes, then test again.`;
 actionUrl = `https://console.cloud.google.com/apis/api/meet.googleapis.com/overview?project=${projectId}`;
 isConfigIssue = true;
 }
 // Invalid grant (token expired)
 else if (error.message?.includes('invalid_grant') || error.message?.includes('token')) {
 errorMessage = 'Your authentication token has expired or been revoked. Please reconnect this integration.';
 isConfigIssue = false;
 }

 return { 
 success: false, 
 error: errorMessage,
 actionUrl: actionUrl,
 isConfigIssue: isConfigIssue,
 needsReconnect: error.message?.includes('invalid_grant') || error.message?.includes('token')
 };
 }
 }

 /**
 * Delete integration credentials
 * @param {String} userId - User ID
 * @param {String} service - Service name
 */
 async deleteCredentials(userId, service) {
 const { error } = await this.supabase
 .from('integration_credentials')
 .delete()
 .eq('user_id', userId)
 .eq('service', service);

 if (error) {
 logger.error('[IntegrationCredentials] Failed to delete credentials:', error);
 throw new Error(`Failed to delete credentials: ${error.message}`);
 }

 return { success: true };
 }

 /**
 * Update last used timestamp
 * @param {String} credentialId - Credential ID
 */
 async updateLastUsed(credentialId) {
 await this.supabase
 .from('integration_credentials')
 .update({ last_used_at: new Date().toISOString() })
 .eq('id', credentialId);
 }

 /**
 * Get integration class by service name
 * @private
 */
 _getIntegrationClass(service) {
 const integrations = {
 slack: require('./integrations/slackIntegration'),
 gmail: require('./integrations/gmailIntegration'),
 google_sheets: require('./integrations/googleSheetsIntegration'),
 google_meet: require('./integrations/googleMeetIntegration'),
 google_drive: require('./integrations/googleDriveIntegration'),
 google_calendar: require('./integrations/googleCalendarIntegration'),
 whatsapp: require('./integrations/whatsappIntegration'),
 notion: require('./integrations/notionIntegration'),
 reddit: require('./integrations/redditIntegration'),
  airtable: require('./integrations/airtableIntegration'),
  trello: require('./integrations/trelloIntegration')
 };

 const IntegrationClass = integrations[service];
 if (!IntegrationClass) {
 throw new Error(`Integration not found for service: ${service}`);
 }

 return IntegrationClass;
 }

 /**
 * Store OAuth state for flow management
 * @param {String} userId - User ID
 * @param {String} service - Service name
 * @param {String} redirectUri - OAuth redirect URI
 * @param {Object} metadata - Additional metadata
 */
 async storeOAuthState(userId, service, redirectUri, metadata = {}) {
 const stateToken = crypto.randomBytes(32).toString('hex');

 const { data, error } = await this.supabase
 .from('integration_oauth_states')
 .insert({
 user_id: userId,
 service,
 state_token: stateToken,
 redirect_uri: redirectUri,
 metadata,
 expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
 })
 .select()
 .single();

 if (error) {
 logger.error('[IntegrationCredentials] Failed to store OAuth state:', error);
 throw new Error(`Failed to store OAuth state: ${error.message}`);
 }

 return data.state_token;
 }

 /**
 * Validate and retrieve OAuth state
 * @param {String} stateToken - OAuth state token
 * @param {Object} options - { peek: boolean } - If true, don't delete the state token
 */
 async validateOAuthState(stateToken, options = {}) {
 const { peek = false } = options;

 const { data, error } = await this.supabase
 .from('integration_oauth_states')
 .select('*')
 .eq('state_token', stateToken)
 .gt('expires_at', new Date().toISOString())
 .maybeSingle();

 if (error) {
 logger.error('[IntegrationCredentials] Failed to validate OAuth state:', error);
 throw new Error(`Failed to validate OAuth state: ${error.message}`);
 }

 if (!data) {
 return null; // Expired or invalid
 }

 // Delete used state only if not peeking
 if (!peek) {
 await this.supabase
 .from('integration_oauth_states')
 .delete()
 .eq('id', data.id);
 }

 return data;
 }
}

module.exports = new IntegrationCredentialsService();

