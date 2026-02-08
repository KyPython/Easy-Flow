/**
 * Tests for OAuth Integration Routes
 * Verifies:
 * - /oauth/start generates proper redirect URLs for all providers
 * - /oauth/callback handles code exchange and stores credentials
 * - Error handling for invalid state, missing codes, API failures
 */

process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_TOKEN = 'true';

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');
const axios = require('axios');

jest.mock('axios');

const mockStateToken = 'mock-state-123456';
const mockOAuthState = {
  user_id: 'test-user-id',
  service: 'teams',
  state_token: mockStateToken,
  redirect_uri: 'http://localhost:3000/integrations',
  metadata: {},
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
};

jest.mock('../services/integrationCredentialsService', () => {
  return {
    listIntegrations: jest.fn(),
    getCredentials: jest.fn(),
    storeCredentials: jest.fn().mockResolvedValue({ id: 'cred-123' }),
    deleteCredentials: jest.fn(),
    testConnection: jest.fn(),
    storeOAuthState: jest.fn().mockResolvedValue(mockStateToken),
    validateOAuthState: jest.fn().mockResolvedValue(mockOAuthState),
  };
});

jest.mock('../middleware/planEnforcement', () => ({
  requireFeature: () => (req, _res, next) => next(),
  requireAutomationRun: () => (req, _res, next) => next(),
  requireWorkflowRun: () => (req, _res, next) => next(),
  requirePlan: () => (req, _res, next) => next(),
  checkStorageLimit: () => (req, _res, next) => next(),
}));

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    if (!req.user) req.user = { id: 'test-user-id' };
    next();
  },
}));

const app = require('../app');

function auth() {
  return { Authorization: 'Bearer test-token' };
}

describe('OAuth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/integrations/oauth/start', () => {
    test('generates redirect URL for Teams OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'teams', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://login.microsoftonline.com');
      expect(res.body.redirectUrl).toContain('client_id=');
      expect(res.body.redirectUrl).toContain('redirect_uri=');
      expect(res.body.redirectUrl).toContain('state=');

      const svc = require('../services/integrationCredentialsService');
      expect(svc.storeOAuthState).toHaveBeenCalledWith(
        'test-user-id',
        'teams',
        '/integrations',
        expect.any(Object)
      );
    });

    test('generates redirect URL for Dropbox OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'dropbox', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://www.dropbox.com/oauth2/authorize');
    });

    test('generates redirect URL for Salesforce OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'salesforce', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://login.salesforce.com/services/oauth2/authorize');
    });

    test('generates redirect URL for HubSpot OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'hubspot', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://app.hubspot.com/oauth/authorize');
    });

    test('generates redirect URL for QuickBooks OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'quickbooks', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://appcenter.intuit.com/connect/oauth2');
    });

    test('generates redirect URL for Asana OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'asana', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://app.asana.com/-/oauth_authorize');
    });

    test('generates redirect URL for LinkedIn OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'linkedin', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
    });

    test('generates redirect URL for Twitter OAuth', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'twitter', returnPath: '/integrations' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toContain('https://twitter.com/i/oauth2/authorize');
    });

    test('rejects unsupported service', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'unknown_service', returnPath: '/integrations' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unknown OAuth service');
    });

    test('validates returnPath against SSRF', async () => {
      const res = await request(app)
        .post('/api/integrations/oauth/start')
        .set(auth())
        .send({ service: 'teams', returnPath: 'http://evil.com/callback' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid return path');
    });
  });

  describe('GET /api/integrations/oauth/callback', () => {
    test('handles Teams OAuth callback and stores credentials', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600
        }
      });

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'auth-code-123',
          state: mockStateToken
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/integrations?success=true&service=teams');

      const svc = require('../services/integrationCredentialsService');
      expect(svc.validateOAuthState).toHaveBeenCalledWith(mockStateToken, { peek: false });
      expect(svc.storeCredentials).toHaveBeenCalledWith(
        'test-user-id',
        'teams',
        expect.objectContaining({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        }),
        expect.any(Object)
      );
    });

    test('handles Dropbox OAuth callback', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.validateOAuthState.mockResolvedValueOnce({
        ...mockOAuthState,
        service: 'dropbox'
      });

      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'dbx-token-123',
          expires_in: 14400
        }
      });

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'dropbox-code',
          state: mockStateToken
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('service=dropbox');
      expect(svc.storeCredentials).toHaveBeenCalledWith(
        'test-user-id',
        'dropbox',
        expect.objectContaining({
          accessToken: 'dbx-token-123'
        }),
        expect.any(Object)
      );
    });

    test('handles Salesforce OAuth callback with instance_url', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.validateOAuthState.mockResolvedValueOnce({
        ...mockOAuthState,
        service: 'salesforce'
      });

      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'sf-token',
          refresh_token: 'sf-refresh',
          instance_url: 'https://example.salesforce.com'
        }
      });

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'sf-code',
          state: mockStateToken
        });

      expect(res.status).toBe(302);
      expect(svc.storeCredentials).toHaveBeenCalledWith(
        'test-user-id',
        'salesforce',
        expect.objectContaining({
          accessToken: 'sf-token',
          instanceUrl: 'https://example.salesforce.com'
        }),
        expect.any(Object)
      );
    });

    test('handles QuickBooks OAuth callback with realmId', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.validateOAuthState.mockResolvedValueOnce({
        ...mockOAuthState,
        service: 'quickbooks'
      });

      axios.post.mockResolvedValueOnce({
        data: {
          access_token: 'qb-token',
          refresh_token: 'qb-refresh'
        }
      });

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'qb-code',
          state: mockStateToken,
          realmId: 'realm123'
        });

      expect(res.status).toBe(302);
      expect(svc.storeCredentials).toHaveBeenCalledWith(
        'test-user-id',
        'quickbooks',
        expect.objectContaining({
          accessToken: 'qb-token',
          realmId: 'realm123'
        }),
        expect.any(Object)
      );
    });

    test('rejects callback with invalid state', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.validateOAuthState.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'code-123',
          state: 'invalid-state'
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
      expect(res.headers.location).toContain('Invalid or expired state');
    });

    test('handles token exchange failure', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'invalid_grant', error_description: 'Code expired' }
        }
      });

      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          code: 'expired-code',
          state: mockStateToken
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
    });

    test('handles OAuth error parameter in callback', async () => {
      const res = await request(app)
        .get('/api/integrations/oauth/callback')
        .query({
          error: 'access_denied',
          error_description: 'User cancelled',
          state: mockStateToken
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=');
      expect(res.headers.location).toContain('User cancelled');
    });
  });
});
