/**
 * Integration Management Routes
 * Handles connecting, testing, and managing external integrations
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const integrationCredentialsService = require('../services/integrationCredentialsService');
const oauthService = require('../services/oauthService');
const { requireAuth } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planEnforcement');
const { checkIntegrationLimit } = require('../middleware/comprehensiveRateLimit');
const { validateUrlForSSRF, validateReturnPath } = require('../utils/ssrfProtection');

/**
 * GET /api/integrations/usage
 * Get integration usage stats (workflows, recent activity)
 * Requires: custom_integrations feature (Professional+)
 * NOTE: This route must come before /:service to avoid route conflicts
 */
router.get('/usage', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const { getSupabase } = require('../utils/supabaseClient');
 const supabase = getSupabase();
 const usage = {};

 // Map integration service names to their action types
 const integrationActions = {
 slack: ['slack_send', 'slack_read', 'slack_collect_feedback'],
 gmail: ['gmail_send', 'gmail_read', 'gmail_collect_feedback'],
 google_sheets: ['sheets_read', 'sheets_write', 'sheets_compile_feedback'],
 google_meet: ['meet_transcribe', 'meet_process_recordings'],
 google_drive: ['drive_upload', 'drive_create_folder'],
 google_calendar: ['calendar_read', 'calendar_create', 'calendar_update', 'calendar_delete'],
 whatsapp: ['whatsapp_send'],
 notion: ['notion_create_page', 'notion_read_page', 'notion_update_page', 'notion_query_database'],
 reddit: ['reddit_monitor', 'reddit_analyze', 'reddit_generate_insights', 'reddit_generate_blog_topics']
 };

 // Get all workflows for this user
 const { data: workflows, error: workflowsError } = await supabase
 .from('workflows')
 .select('id, name, steps, status')
 .eq('user_id', userId);

 if (workflowsError) {
 logger.warn('[IntegrationRoutes] Error fetching workflows for usage:', workflowsError);
 }

 // For each integration, find workflows that use it
 for (const [serviceId, actionTypes] of Object.entries(integrationActions)) {
 const workflowsUsingService = [];

 if (workflows && actionTypes.length > 0) {
 for (const workflow of workflows) {
 if (!workflow.steps || !Array.isArray(workflow.steps)) continue;

 // Check if any step uses this integration
 const usesIntegration = workflow.steps.some(step => {
 const actionType = step.action_type || step.type;
 return actionTypes.includes(actionType);
 });

 if (usesIntegration) {
 workflowsUsingService.push({
 id: workflow.id,
 name: workflow.name,
 status: workflow.status
 });
 }
 }
 }

 // Count recent workflow executions (last 24 hours) that used this integration
 const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
 let recentActivityCount = 0;

 if (workflowsUsingService.length > 0) {
 const workflowIds = workflowsUsingService.map(w => w.id);
 try {
 const { data: recentExecutions, error: executionsError } = await supabase
 .from('workflow_executions')
 .select('id')
 .in('workflow_id', workflowIds)
 .gte('created_at', oneDayAgo)
 .eq('status', 'completed');

 if (!executionsError && recentExecutions) {
 recentActivityCount = recentExecutions.length;
 } else if (executionsError) {
 // Log but don't fail - table might not exist or be empty
 logger.debug('[IntegrationRoutes] Could not fetch workflow executions', {
 error: executionsError.message,
 serviceId
 });
 }
 } catch (execError) {
 // Gracefully handle if workflow_executions table doesn't exist
 logger.debug('[IntegrationRoutes] Workflow executions query failed', {
 error: execError.message,
 serviceId
 });
 }
 }

 usage[serviceId] = {
 workflowCount: workflowsUsingService.length,
 workflows: workflowsUsingService,
 recentActivityCount
 };
 }

 res.json({
 success: true,
 usage
 });

 } catch (error) {
 logger.error('[IntegrationRoutes] Error fetching usage stats:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/integrations
 * List all connected integrations for the user
 * Requires: custom_integrations feature (Professional+)
 */
router.get('/', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const integrations = await integrationCredentialsService.listIntegrations(userId);

 // ✅ PERFORMANCE: Cache integrations list for 60 seconds
 res.set('Cache-Control', 'private, max-age=60');

 res.json({
 success: true,
 integrations: integrations.map(integration => ({
 id: integration.id,
 service: integration.service,
 displayName: integration.display_name,
 isActive: integration.is_active,
 lastUsedAt: integration.last_used_at,
 lastTestedAt: integration.last_tested_at,
 testStatus: integration.test_status,
 createdAt: integration.created_at
 }))
 });
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to list integrations:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/integrations/:service
 * Get details for a specific integration
 * Requires: custom_integrations feature (Professional+)
 */
router.get('/:service', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const { service } = req.params;

 const credentials = await integrationCredentialsService.getCredentials(userId, service);

 if (!credentials) {
 return res.status(404).json({
 success: false,
 error: `${service} integration not connected`
 });
 }

 // Don't return actual credentials, just metadata
 res.json({
 success: true,
 integration: {
 id: credentials.id,
 service: credentials.service,
 displayName: credentials.displayName,
 expiresAt: credentials.expiresAt,
 lastUsedAt: credentials.lastUsedAt,
 lastTestedAt: credentials.lastTestedAt,
 testStatus: credentials.testStatus,
 createdAt: credentials.createdAt,
 updatedAt: credentials.updatedAt
 }
 });
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to get integration:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/integrations/:service/connect
 * Connect an integration (store credentials)
 * Requires: custom_integrations feature (Professional+)
 * PLAN ENFORCEMENT: Checks custom_integrations feature and integration count limits
 */
router.post('/:service/connect', requireAuth, requireFeature('custom_integrations'), checkIntegrationLimit, async (req, res) => {
 try {
 const userId = req.user.id;
 const { service } = req.params;
 const { credentials, displayName, expiresAt } = req.body;

 if (!credentials) {
 return res.status(400).json({
 success: false,
 error: 'Credentials are required'
 });
 }

 await integrationCredentialsService.storeCredentials(
 userId,
 service,
 credentials,
 { displayName, expiresAt }
 );

 // Automatically test the connection after storing credentials
 // Run asynchronously so it doesn't block the response
 integrationCredentialsService.testConnection(userId, service)
 .then((testResult) => {
 if (testResult.success) {
 logger.info(`[IntegrationRoutes] Auto-test successful for ${service}`, { userId });
 } else {
 logger.warn(`[IntegrationRoutes] Auto-test failed for ${service}:`, testResult.error);
 }
 })
 .catch((testError) => {
 // Log but don't fail the connection if testing fails
 logger.error(`[IntegrationRoutes] Auto-test error for ${service}:`, testError);
 });

 res.json({
 success: true,
 message: `${service} integration connected successfully`
 });
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to connect integration:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/integrations/:service/test
 * Test integration connection
 * Requires: custom_integrations feature (Professional+)
 */
router.post('/:service/test', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const { service } = req.params;

 const result = await integrationCredentialsService.testConnection(userId, service);

 res.json(result);
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to test integration:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * DELETE /api/integrations/:service
 * Disconnect an integration
 * Requires: custom_integrations feature (Professional+)
 */
router.delete('/:service', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const { service } = req.params;

 await integrationCredentialsService.deleteCredentials(userId, service);

 res.json({
 success: true,
 message: `${service} integration disconnected`
 });
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to disconnect integration:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/integrations/:service/oauth/start
 * Start OAuth flow (returns redirect URL)
 * Requires: custom_integrations feature (Professional+)
 */
router.get('/:service/oauth/start', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
 try {
 const userId = req.user.id;
 const { service } = req.params;
 const redirectUri = req.query.redirect_uri || `${req.protocol}://${req.get('host')}/api/integrations/${service}/oauth/callback`;
 const returnPath = req.query.return_path || '/app/integrations';

 // Log the redirect URI for debugging
 logger.info('[IntegrationRoutes] OAuth start', {
 service,
 redirectUri,
 frontendHostname: req.get('referer') || 'unknown',
 queryRedirectUri: req.query.redirect_uri
 });

 // Generate OAuth state token with return path in metadata
 const stateToken = await integrationCredentialsService.storeOAuthState(
 userId,
 service,
 redirectUri,
 { return_path: returnPath }
 );

 // Get OAuth URL based on service
 const oauthUrl = await getOAuthUrl(service, stateToken, redirectUri);

 res.json({
 success: true,
 oauthUrl,
 stateToken
 });
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to start OAuth:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * GET /api/integrations/:service/oauth/callback
 * OAuth callback handler
 * Note: This route doesn't use requireAuth because OAuth providers redirect here
 * without auth tokens. Instead, we authenticate via the state token.
 */
router.get('/:service/oauth/callback', async (req, res) => {
 try {
 const { service } = req.params;
 const { code, state, error } = req.query;

 // Get frontend URL for redirect
 const frontendUrl = process.env.FRONTEND_URL ||
 (process.env.NODE_ENV === 'development'
 ? `http://localhost:${process.env.FRONTEND_PORT || '3000'}`
 : 'http://localhost:3000');

 // ✅ SECURITY: Validate return path to prevent open redirect attacks
 // Try to get return path from state (for error cases before validation)
 // Use peek: true to avoid consuming the state token
 let fallbackReturnPath = '/app/integrations';
 if (state) {
 try {
 const tempState = await integrationCredentialsService.validateOAuthState(state, { peek: true });
 if (tempState?.metadata?.return_path) {
 const pathValidation = validateReturnPath(tempState.metadata.return_path);
 fallbackReturnPath = pathValidation.valid ? pathValidation.path : '/app/integrations';
 }
 } catch (e) {
 // Ignore errors when getting return path for error redirects
 }
 }

 // Validate fallback path as well
 const fallbackValidation = validateReturnPath(fallbackReturnPath);
 const safeFallbackPath = fallbackValidation.valid ? fallbackValidation.path : '/app/integrations';

 if (error) {
 return res.redirect(`${frontendUrl}${safeFallbackPath}?error=${encodeURIComponent(error)}`);
 }

 if (!code || !state) {
 return res.redirect(`${frontendUrl}${safeFallbackPath}?error=missing_code_or_state`);
 }

 // Validate state token and get user_id from it (this will consume/delete the token)
 const oauthState = await integrationCredentialsService.validateOAuthState(state);
 if (!oauthState) {
 logger.error('[IntegrationRoutes] Invalid or expired OAuth state token', { state, service });
 return res.redirect(`${frontendUrl}${safeFallbackPath}?error=invalid_or_expired_state`);
 }

 const userId = oauthState.user_id;

 // Get return path from metadata, default to /app/integrations
 const rawReturnPath = oauthState.metadata?.return_path || '/app/integrations';

 // ✅ SECURITY: Validate return path to prevent open redirect attacks
 const pathValidation = validateReturnPath(rawReturnPath);
 const finalReturnPath = pathValidation.valid ? pathValidation.path : '/app/integrations';

 // Exchange code for tokens
 const credentials = await exchangeOAuthCode(service, code, oauthState.redirect_uri);

 // Store credentials
 await integrationCredentialsService.storeCredentials(
 userId,
 service,
 credentials,
 { expiresAt: credentials.expiresAt }
 );

 // Automatically test the connection after storing credentials
 // Run asynchronously so it doesn't block the redirect
 integrationCredentialsService.testConnection(userId, service)
 .then((testResult) => {
 if (testResult.success) {
 logger.info(`[IntegrationRoutes] Auto-test successful for ${service}`, { userId });
 } else {
 logger.warn(`[IntegrationRoutes] Auto-test failed for ${service}:`, testResult.error);
 }
 })
 .catch((testError) => {
 // Log but don't fail the OAuth flow if testing fails
 logger.error(`[IntegrationRoutes] Auto-test error for ${service}:`, testError);
 });

 res.redirect(`${frontendUrl}${finalReturnPath}?success=true`);
 } catch (error) {
 logger.error('[IntegrationRoutes] OAuth callback failed:', error);
 const frontendUrl = process.env.FRONTEND_URL ||
 (process.env.NODE_ENV === 'development'
 ? `http://localhost:${process.env.FRONTEND_PORT || '3000'}`
 : 'http://localhost:3000');
 res.redirect(`${frontendUrl}/app/integrations?error=${encodeURIComponent(error.message)}`);
 }
});

/**
 * Get OAuth URL for a service
 * @private
 */
async function getOAuthUrl(service, stateToken, redirectUri) {
  // Wrapper function that delegates to oauthService
  // Maintains backward compatibility while reducing complexity
  return oauthService.generateOAuthUrl(service, stateToken, redirectUri);
}

/**
 * Exchange OAuth code for tokens
 * @private
 */
async function exchangeOAuthCode(service, code, redirectUri) {
 const axios = require('axios');
 // Use the redirectUri that was used in the authorization request (stored in OAuth state)
 // This MUST match exactly what was sent to Google/Slack, otherwise we get a 400 error
 let callbackUrl;
 if (redirectUri && redirectUri.includes('/api/integrations/')) {
 // redirectUri is already a full callback URL
 callbackUrl = redirectUri;
 } else {
 // Fallback: construct from redirectUri as base URL or API_BASE_URL
 const baseUrl = redirectUri || (process.env.API_BASE_URL || 'http://localhost:3030');
 callbackUrl = `${baseUrl}/api/integrations/${service}/oauth/callback`;
 }

 // ✅ SECURITY: Validate callback URL to prevent SSRF attacks
 // For OAuth, allow localhost in development but require proper URL format
 const urlValidation = validateUrlForSSRF(callbackUrl, { allowPrivateIPs: process.env.NODE_ENV !== 'production' });
 if (!urlValidation.valid) {
 logger.error('[IntegrationRoutes] Invalid callback URL rejected:', {
 service,
 callbackUrl,
 error: urlValidation.error
 });
 throw new Error(`Invalid callback URL: ${urlValidation.error}. OAuth redirect URI must be a valid URL.`);
 }
 callbackUrl = urlValidation.url; // Use validated URL

 switch (service) {
 case 'slack': {
 const slackClientId = process.env.SLACK_CLIENT_ID;
 const slackClientSecret = process.env.SLACK_CLIENT_SECRET;

 const slackResponse = await axios.post('https://slack.com/api/oauth.v2.access', null, {
 params: {
 client_id: slackClientId,
 client_secret: slackClientSecret,
 code,
 redirect_uri: callbackUrl
 }
 });

 if (!slackResponse.data.ok) {
 const errorMsg = slackResponse.data.error || 'Unknown error';
 const errorDescription = slackResponse.data.error_description || '';
 logger.error('[IntegrationRoutes] Slack OAuth error:', {
 error: errorMsg,
 description: errorDescription,
 response: slackResponse.data
 });
 throw new Error(`Slack OAuth error: ${errorMsg}${errorDescription ? ` - ${errorDescription}` : ''}`);
 }

 return {
 accessToken: slackResponse.data.access_token,
 botToken: slackResponse.data.bot?.bot_access_token || slackResponse.data.access_token
 };
 }

 case 'gmail':
 case 'google_sheets':
 case 'google_meet':
 case 'google_drive':
 case 'google_calendar': {
 const googleClientId = process.env.GOOGLE_CLIENT_ID;
 const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

 const googleResponse = await axios.post('https://oauth2.googleapis.com/token', null, {
 params: {
 client_id: googleClientId,
 client_secret: googleClientSecret,
 code,
 redirect_uri: callbackUrl,
 grant_type: 'authorization_code'
 }
 });

 return {
 accessToken: googleResponse.data.access_token,
 refreshToken: googleResponse.data.refresh_token,
 clientId: googleClientId,
 clientSecret: googleClientSecret,
 expiresAt: new Date(Date.now() + googleResponse.data.expires_in * 1000).toISOString()
 };
 }

 case 'notion': {
 const notionClientId = process.env.NOTION_CLIENT_ID;
 const notionClientSecret = process.env.NOTION_CLIENT_SECRET;

 if (!notionClientId || !notionClientSecret) {
 throw new Error('NOTION_CLIENT_ID and NOTION_CLIENT_SECRET must be configured');
 }

 // Notion OAuth token exchange
 const notionResponse = await axios.post('https://api.notion.com/v1/oauth/token', {
 grant_type: 'authorization_code',
 code,
 redirect_uri: callbackUrl
 }, {
 auth: {
 username: notionClientId,
 password: notionClientSecret
 },
 headers: {
 'Content-Type': 'application/json'
 }
 });

 return {
 accessToken: notionResponse.data.access_token,
 botId: notionResponse.data.bot_id,
 workspaceId: notionResponse.data.workspace_id,
 workspaceName: notionResponse.data.workspace_name
 };
 }

 case 'whatsapp': {
 // Meta WhatsApp Business API OAuth token exchange
 const facebookAppId = process.env.FACEBOOK_APP_ID;
 const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;

 if (!facebookAppId || !facebookAppSecret) {
 throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured for WhatsApp OAuth');
 }

 // Exchange authorization code for access token
 const facebookTokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
 params: {
 client_id: facebookAppId,
 client_secret: facebookAppSecret,
 redirect_uri: callbackUrl,
 code
 }
 });

 const accessToken = facebookTokenResponse.data.access_token;

 // Get user's WhatsApp Business Account info
 // First, get the user's business accounts
 let phoneNumberId = null;
 let businessAccountId = null;

 try {
 // Get user's businesses
 const businessesResponse = await axios.get('https://graph.facebook.com/v18.0/me/businesses', {
 headers: { 'Authorization': `Bearer ${accessToken}` }
 });

 if (businessesResponse.data.data && businessesResponse.data.data.length > 0) {
 businessAccountId = businessesResponse.data.data[0].id;

 // Get WhatsApp Business Account for this business
 const wabaResponse = await axios.get(`https://graph.facebook.com/v18.0/${businessAccountId}/owned_whatsapp_business_accounts`, {
 headers: { 'Authorization': `Bearer ${accessToken}` }
 });

 if (wabaResponse.data.data && wabaResponse.data.data.length > 0) {
 const wabaId = wabaResponse.data.data[0].id;

 // Get phone numbers for this WhatsApp Business Account
 const phoneNumbersResponse = await axios.get(`https://graph.facebook.com/v18.0/${wabaId}/phone_numbers`, {
 headers: { 'Authorization': `Bearer ${accessToken}` }
 });

 if (phoneNumbersResponse.data.data && phoneNumbersResponse.data.data.length > 0) {
 phoneNumberId = phoneNumbersResponse.data.data[0].id;
 }
 }
 }
 } catch (error) {
 logger.warn('[IntegrationRoutes] Could not fetch WhatsApp Business Account details:', error.message);
 // Continue anyway - user can provide phoneNumberId manually if needed
 }

 return {
 provider: 'meta',
 accessToken,
 phoneNumberId,
 businessAccountId,
 expiresAt: facebookTokenResponse.data.expires_in
 ? new Date(Date.now() + facebookTokenResponse.data.expires_in * 1000).toISOString()
 : null
 };
 }

 // Microsoft Teams (Azure AD / MS Graph)
 case 'teams': {
 const clientId = process.env.TEAMS_CLIENT_ID;
 const clientSecret = process.env.TEAMS_CLIENT_SECRET;
 const tenant = process.env.AZURE_TENANT_ID || 'common';
 const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
 const params = new URLSearchParams();
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 params.append('grant_type', 'authorization_code');
 params.append('code', code);
 params.append('redirect_uri', callbackUrl);
 params.append('scope', 'offline_access User.Read');
 const response = await axios.post(tokenUrl, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // Dropbox
 case 'dropbox': {
 const clientId = process.env.DROPBOX_CLIENT_ID;
 const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('code', code);
 params.append('grant_type', 'authorization_code');
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 params.append('redirect_uri', callbackUrl);
 const response = await axios.post('https://api.dropboxapi.com/oauth2/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 accountId: response.data.account_id,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // Salesforce
 case 'salesforce': {
 const clientId = process.env.SALESFORCE_CLIENT_ID;
 const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('code', code);
 params.append('grant_type', 'authorization_code');
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 params.append('redirect_uri', callbackUrl);
 const response = await axios.post('https://login.salesforce.com/services/oauth2/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 instanceUrl: response.data.instance_url,
 id: response.data.id,
 tokenType: response.data.token_type,
 issuedAt: response.data.issued_at
 };
 }

 // HubSpot
 case 'hubspot': {
 const clientId = process.env.HUBSPOT_CLIENT_ID;
 const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('grant_type', 'authorization_code');
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 params.append('redirect_uri', callbackUrl);
 params.append('code', code);
 const response = await axios.post('https://api.hubapi.com/oauth/v1/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // QuickBooks (Intuit)
 case 'quickbooks': {
 const clientId = process.env.QUICKBOOKS_CLIENT_ID;
 const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('grant_type', 'authorization_code');
 params.append('code', code);
 params.append('redirect_uri', callbackUrl);
 const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', params.toString(), {
 headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 auth: { username: clientId || '', password: clientSecret || '' }
 });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 tokenType: response.data.token_type,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // Asana
 case 'asana': {
 const clientId = process.env.ASANA_CLIENT_ID;
 const clientSecret = process.env.ASANA_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('grant_type', 'authorization_code');
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 params.append('redirect_uri', callbackUrl);
 params.append('code', code);
 const response = await axios.post('https://app.asana.com/-/oauth_token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 tokenType: response.data.token_type,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // LinkedIn
 case 'linkedin': {
 const clientId = process.env.LINKEDIN_CLIENT_ID;
 const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('grant_type', 'authorization_code');
 params.append('code', code);
 params.append('redirect_uri', callbackUrl);
 params.append('client_id', clientId || '');
 params.append('client_secret', clientSecret || '');
 const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null
 };
 }

 // Twitter (OAuth 2.0)
 case 'twitter': {
 const clientId = process.env.TWITTER_CLIENT_ID;
 const clientSecret = process.env.TWITTER_CLIENT_SECRET;
 const params = new URLSearchParams();
 params.append('client_id', clientId || '');
 params.append('grant_type', 'authorization_code');
 params.append('code', code);
 params.append('redirect_uri', callbackUrl);
 params.append('code_verifier', 'easyflow-placeholder');
 const response = await axios.post('https://api.twitter.com/2/oauth2/token', params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
 return {
 accessToken: response.data.access_token,
 refreshToken: response.data.refresh_token,
 expiresAt: response.data.expires_in ? new Date(Date.now() + response.data.expires_in * 1000).toISOString() : null,
 tokenType: response.data.token_type
 };
 }

 default:
 throw new Error(`OAuth exchange not supported for service: ${service}`);
 }
}

/**
 * POST /api/integrations/seed-knowledge
 * Seed integration knowledge to RAG service (for AI assistant)
 */
router.post('/seed-knowledge', requireAuth, async (req, res) => {
 try {
 const { addIntegrationKnowledge } = require('../services/addIntegrationKnowledge');
 const result = await addIntegrationKnowledge();

 if (result.success) {
 res.json({
 success: true,
 message: 'Integration knowledge added to AI assistant'
 });
 } else {
 res.status(500).json({
 success: false,
 error: result.error
 });
 }
 } catch (error) {
 logger.error('[IntegrationRoutes] Failed to seed knowledge:', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

module.exports = router;

