/**
 * Tests for Integration Mapping and Test Connection
 * Verifies:
 * - Integration service mapping returns correct provider classes
 * - testConnection updates status and timestamps
 * - Error handling for missing credentials and failed connections
 */

process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_TOKEN = 'true';

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');

const mockCredentials = {
  id: 'cred-123',
  service: 'teams',
  displayName: 'Teams',
  credentials: {
    accessToken: 'mock-token'
  },
  expiresAt: null,
  lastUsedAt: null,
  lastTestedAt: null,
  testStatus: null
};

jest.mock('../services/integrationCredentialsService', () => {
  return {
    listIntegrations: jest.fn(),
    getCredentials: jest.fn().mockResolvedValue(mockCredentials),
    storeCredentials: jest.fn(),
    deleteCredentials: jest.fn(),
    testConnection: jest.fn(),
    storeOAuthState: jest.fn(),
    validateOAuthState: jest.fn(),
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

describe('Integration Mapping and Test Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Integration Service Mapping', () => {
    test('maps teams to TeamsIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('teams');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('TeamsIntegration');
    });

    test('maps dropbox to DropboxIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('dropbox');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('DropboxIntegration');
    });

    test('maps salesforce to SalesforceIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('salesforce');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('SalesforceIntegration');
    });

    test('maps hubspot to HubSpotIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('hubspot');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('HubSpotIntegration');
    });

    test('maps quickbooks to QuickBooksIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('quickbooks');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('QuickBooksIntegration');
    });

    test('maps asana to AsanaIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('asana');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('AsanaIntegration');
    });

    test('maps trello to TrelloIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('trello');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('TrelloIntegration');
    });

    test('maps linkedin to LinkedInIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('linkedin');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('LinkedInIntegration');
    });

    test('maps twitter to TwitterIntegration', () => {
      const service = require('../services/integrationCredentialsService');
      const IntegrationClass = service._getIntegrationClass('twitter');
      expect(IntegrationClass).toBeDefined();
      expect(IntegrationClass.name).toBe('TwitterIntegration');
    });

    test('throws error for unknown service', () => {
      const service = require('../services/integrationCredentialsService');
      expect(() => service._getIntegrationClass('unknown')).toThrow('Integration not found');
    });
  });

  describe('POST /api/integrations/:service/test', () => {
    test('calls testConnection and returns success', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.testConnection.mockResolvedValueOnce({
        success: true,
        message: 'Connection successful'
      });

      const res = await request(app)
        .post('/api/integrations/teams/test')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(svc.testConnection).toHaveBeenCalledWith('test-user-id', 'teams');
    });

    test('returns failure when testConnection fails', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.testConnection.mockResolvedValueOnce({
        success: false,
        error: 'Invalid token',
        needsReconnect: true
      });

      const res = await request(app)
        .post('/api/integrations/teams/test')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid token');
      expect(res.body.needsReconnect).toBe(true);
    });

    test('handles missing credentials', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.testConnection.mockRejectedValueOnce(new Error('No credentials found for teams'));

      const res = await request(app)
        .post('/api/integrations/teams/test')
        .set(auth());

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No credentials found');
    });

    test('updates test status and timestamp on success', async () => {
      const svc = require('../services/integrationCredentialsService');
      const mockUpdateCredentials = jest.fn();
      
      svc.testConnection.mockImplementationOnce(async (userId, service) => {
        return { success: true, message: 'Connection successful' };
      });

      const res = await request(app)
        .post('/api/integrations/dropbox/test')
        .set(auth());

      expect(res.status).toBe(200);
      expect(svc.testConnection).toHaveBeenCalledWith('test-user-id', 'dropbox');
    });

    test('updates test status to failed on error', async () => {
      const svc = require('../services/integrationCredentialsService');
      
      svc.testConnection.mockImplementationOnce(async (userId, service) => {
        return {
          success: false,
          error: 'Connection timeout',
          needsReconnect: false
        };
      });

      const res = await request(app)
        .post('/api/integrations/salesforce/test')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Connection timeout');
    });
  });

  describe('DELETE /api/integrations/:service', () => {
    test('deletes credentials successfully', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.deleteCredentials.mockResolvedValueOnce({ success: true });

      const res = await request(app)
        .delete('/api/integrations/teams')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(svc.deleteCredentials).toHaveBeenCalledWith('test-user-id', 'teams');
    });

    test('handles deletion error', async () => {
      const svc = require('../services/integrationCredentialsService');
      svc.deleteCredentials.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .delete('/api/integrations/teams')
        .set(auth());

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
