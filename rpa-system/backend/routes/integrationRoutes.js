/**
 * Integration Management Routes
 * Handles connecting, testing, and managing external integrations
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const integrationCredentialsService = require('../services/integrationCredentialsService');
const { requireAuth } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planEnforcement');
const { checkIntegrationLimit } = require('../middleware/comprehensiveRateLimit');

/**
 * GET /api/integrations
 * List all connected integrations for the user
 * Requires: custom_integrations feature (Professional+)
 */
router.get('/', requireAuth, requireFeature('custom_integrations'), async (req, res) => {
  try {
    const userId = req.user.id;
    const integrations = await integrationCredentialsService.listIntegrations(userId);
    
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
    
    // Generate OAuth state token
    const stateToken = await integrationCredentialsService.storeOAuthState(
      userId,
      service,
      redirectUri
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
 */
router.get('/:service/oauth/callback', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { service } = req.params;
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      return res.redirect('/settings/integrations?error=missing_code_or_state');
    }
    
    // Validate state token
    const oauthState = await integrationCredentialsService.validateOAuthState(state);
    if (!oauthState || oauthState.user_id !== userId) {
      return res.redirect('/settings/integrations?error=invalid_state');
    }
    
    // Exchange code for tokens
    const credentials = await exchangeOAuthCode(service, code, oauthState.redirect_uri);
    
    // Store credentials
    await integrationCredentialsService.storeCredentials(
      userId,
      service,
      credentials,
      { expiresAt: credentials.expiresAt }
    );
    
    res.redirect('/settings/integrations?success=true');
  } catch (error) {
    logger.error('[IntegrationRoutes] OAuth callback failed:', error);
    res.redirect(`/settings/integrations?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Get OAuth URL for a service
 * @private
 */
async function getOAuthUrl(service, stateToken, redirectUri) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3030';
  const callbackUrl = `${baseUrl}/api/integrations/${service}/oauth/callback`;
  
  switch (service) {
    case 'slack':
      const slackClientId = process.env.SLACK_CLIENT_ID;
      if (!slackClientId) {
        const error = new Error('SLACK_CLIENT_ID not configured');
        error.statusCode = 503;
        throw error;
      }
      
      const slackScopes = 'chat:write,channels:read,channels:history,files:write';
      return `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=${slackScopes}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${stateToken}`;
    
    case 'gmail':
    case 'google_sheets':
    case 'google_meet':
    case 'google_drive':
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        const error = new Error('GOOGLE_CLIENT_ID not configured');
        error.statusCode = 503;
        throw error;
      }
      
      const scopes = {
        gmail: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        google_sheets: 'https://www.googleapis.com/auth/spreadsheets',
        google_meet: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly',
        google_drive: 'https://www.googleapis.com/auth/drive'
      };
      
      const scope = scopes[service] || scopes.google_drive;
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${stateToken}`;
    
    default:
      throw new Error(`OAuth not supported for service: ${service}`);
  }
}

/**
 * Exchange OAuth code for tokens
 * @private
 */
async function exchangeOAuthCode(service, code, redirectUri) {
  const axios = require('axios');
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3030';
  const callbackUrl = `${baseUrl}/api/integrations/${service}/oauth/callback`;
  
  switch (service) {
    case 'slack':
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
        throw new Error(`Slack OAuth error: ${slackResponse.data.error}`);
      }
      
      return {
        accessToken: slackResponse.data.access_token,
        botToken: slackResponse.data.bot?.bot_access_token || slackResponse.data.access_token
      };
    
    case 'gmail':
    case 'google_sheets':
    case 'google_meet':
    case 'google_drive':
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

