const { getLogger } = require('../utils/logger');

const logger = getLogger('oauthService');

/**
 * OAuth Service - Handles OAuth URL generation and configuration for multiple providers
 * Extracted from integrationRoutes.js to reduce complexity
 */

/**
 * Gets the callback URL for OAuth redirects
 * @param {string} service - Service identifier (e.g., 'slack', 'gmail')
 * @param {string} redirectUri - Optional full redirect URI or base URL
 * @returns {string} Full callback URL
 */
function getOAuthCallbackUrl(service, redirectUri) {
  if (redirectUri && redirectUri.includes('/api/integrations/')) {
    return redirectUri;
  }

  const baseUrl = redirectUri || (process.env.API_BASE_URL || 'http://localhost:3030');
  return `${baseUrl}/api/integrations/${service}/oauth/callback`;
}

/**
 * Validates that required environment variable exists
 * @param {string} envVar - Environment variable name
 * @param {string} service - Service name for error message
 * @throws {Error} If environment variable is missing
 */
function requireEnvVar(envVar, service) {
  const value = process.env[envVar];
  if (!value) {
    const error = new Error(`${envVar} not configured for ${service}`);
    error.statusCode = 503;
    throw error;
  }
  return value;
}

/**
 * Generates Slack OAuth URL
 */
function getSlackOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('SLACK_CLIENT_ID', 'Slack');
  const scopes = 'chat:write,channels:read,channels:history,files:write';

  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${stateToken}`;
}

/**
 * Google OAuth scopes by service
 */
const GOOGLE_SCOPES = {
  gmail: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
  google_sheets: 'https://www.googleapis.com/auth/spreadsheets',
  google_meet: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly',
  google_drive: 'https://www.googleapis.com/auth/drive',
  google_calendar: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events'
};

/**
 * Generates Google OAuth URL (for Gmail, Sheets, Meet, Drive, Calendar)
 */
function getGoogleOAuthUrl(service, stateToken, callbackUrl) {
  const clientId = requireEnvVar('GOOGLE_CLIENT_ID', 'Google');
  const scope = GOOGLE_SCOPES[service] || GOOGLE_SCOPES.google_drive;

  logger.info('[OAuthService] Google OAuth URL generated', {
    service,
    callbackUrl,
    scope: scope.substring(0, 50) + '...'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${stateToken}`;
}

/**
 * Generates Notion OAuth URL
 */
function getNotionOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('NOTION_CLIENT_ID', 'Notion');

  return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&owner=user&state=${stateToken}`;
}

/**
 * Generates WhatsApp OAuth URL (via Facebook)
 */
function getWhatsAppOAuthUrl(stateToken, callbackUrl) {
  const appId = requireEnvVar('FACEBOOK_APP_ID', 'WhatsApp');
  const scopes = 'whatsapp_business_management,whatsapp_business_messaging,business_management';

  return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&state=${stateToken}&response_type=code`;
}

/**
 * Generates Microsoft OAuth URL (for Teams, Outlook)
 */
function getMicrosoftOAuthUrl(service, stateToken, callbackUrl) {
  const clientId = requireEnvVar('MICROSOFT_CLIENT_ID', 'Microsoft');
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  const scopes = {
    teams: 'https://graph.microsoft.com/Chat.ReadWrite https://graph.microsoft.com/ChannelMessage.Send',
    outlook: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read'
  };

  const scope = scopes[service] || scopes.teams;

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${stateToken}`;
}

/**
 * Generates Asana OAuth URL
 */
function getAsanaOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('ASANA_CLIENT_ID', 'Asana');

  return `https://app.asana.com/-/oauth_authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&state=${stateToken}`;
}

/**
 * Generates Trello OAuth URL
 */
function getTrelloOAuthUrl(stateToken, callbackUrl) {
  const apiKey = requireEnvVar('TRELLO_API_KEY', 'Trello');
  const appName = process.env.TRELLO_APP_NAME || 'EasyFlow Automation';

  return `https://trello.com/1/authorize?expiration=never&name=${encodeURIComponent(appName)}&scope=read,write&response_type=token&key=${apiKey}&return_url=${encodeURIComponent(callbackUrl)}&callback_method=fragment&state=${stateToken}`;
}

/**
 * Generates Linear OAuth URL
 */
function getLinearOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('LINEAR_CLIENT_ID', 'Linear');
  const scopes = 'read,write';

  return `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scopes}&state=${stateToken}`;
}

/**
 * Generates Airtable OAuth URL
 */
function getAirtableOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('AIRTABLE_CLIENT_ID', 'Airtable');
  const scopes = 'data.records:read data.records:write';

  return `https://airtable.com/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scopes}&state=${stateToken}`;
}

/**
 * Generates Zendesk OAuth URL
 */
function getZendeskOAuthUrl(stateToken, callbackUrl) {
  const clientId = requireEnvVar('ZENDESK_CLIENT_ID', 'Zendesk');
  const subdomain = requireEnvVar('ZENDESK_SUBDOMAIN', 'Zendesk');
  const scopes = 'read write';

  return `https://${subdomain}.zendesk.com/oauth/authorizations/new?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&state=${stateToken}`;
}

/**
 * Generates Shopify OAuth URL
 */
function getShopifyOAuthUrl(stateToken, callbackUrl, shopDomain) {
  const clientId = requireEnvVar('SHOPIFY_API_KEY', 'Shopify');
  const scopes = 'read_products,write_products,read_orders,write_orders';

  if (!shopDomain) {
    const error = new Error('Shop domain is required for Shopify OAuth');
    error.statusCode = 400;
    throw error;
  }

  return `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${stateToken}`;
}

/**
 * OAuth service registry - maps service names to their OAuth URL generators
 */
const OAUTH_GENERATORS = {
  slack: getSlackOAuthUrl,
  gmail: getGoogleOAuthUrl,
  google_sheets: getGoogleOAuthUrl,
  google_meet: getGoogleOAuthUrl,
  google_drive: getGoogleOAuthUrl,
  google_calendar: getGoogleOAuthUrl,
  notion: getNotionOAuthUrl,
  whatsapp: getWhatsAppOAuthUrl,
  teams: getMicrosoftOAuthUrl,
  outlook: getMicrosoftOAuthUrl,
  asana: getAsanaOAuthUrl,
  trello: getTrelloOAuthUrl,
  linear: getLinearOAuthUrl,
  airtable: getAirtableOAuthUrl,
  zendesk: getZendeskOAuthUrl,
  shopify: getShopifyOAuthUrl
};

/**
 * Main function: Generates OAuth URL for any supported service
 * @param {string} service - Service identifier
 * @param {string} stateToken - OAuth state token for security
 * @param {string} redirectUri - Optional redirect URI
 * @param {object} options - Additional options (e.g., shopDomain for Shopify)
 * @returns {Promise<string>} OAuth authorization URL
 * @throws {Error} If service is not supported or configuration is missing
 */
async function generateOAuthUrl(service, stateToken, redirectUri, options = {}) {
  const generator = OAUTH_GENERATORS[service];

  if (!generator) {
    const error = new Error(`Unsupported OAuth service: ${service}`);
    error.statusCode = 400;
    throw error;
  }

  const callbackUrl = getOAuthCallbackUrl(service, redirectUri);

  // Some generators need the service name, some don't
  if (generator.length === 2) {
    return generator(stateToken, callbackUrl);
  } else if (generator.length === 3) {
    return generator(service, stateToken, callbackUrl);
  } else {
    // Shopify needs shopDomain
    return generator(stateToken, callbackUrl, options.shopDomain);
  }
}

/**
 * Gets list of supported OAuth services
 * @returns {string[]} Array of supported service names
 */
function getSupportedServices() {
  return Object.keys(OAUTH_GENERATORS);
}

module.exports = {
  generateOAuthUrl,
  getSupportedServices,
  // Export individual generators for testing
  getSlackOAuthUrl,
  getGoogleOAuthUrl,
  getNotionOAuthUrl,
  getWhatsAppOAuthUrl,
  getMicrosoftOAuthUrl,
  getAsanaOAuthUrl,
  getTrelloOAuthUrl,
  getLinearOAuthUrl,
  getAirtableOAuthUrl,
  getZendeskOAuthUrl,
  getShopifyOAuthUrl
};
