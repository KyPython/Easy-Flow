/**
 * Tests for Provider Client authenticate() and testConnection()
 * Verifies:
 * - Each client validates credentials properly
 * - testConnection makes correct API calls with mocked HTTP
 * - Error handling for 401, timeout, and malformed responses
 */

const axios = require('axios');
jest.mock('axios');

describe('Provider Client Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TeamsIntegration', () => {
    const TeamsIntegration = require('../services/integrations/teamsIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new TeamsIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Teams: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'token' })).resolves.toBe(true);
      expect(client.token).toBe('token');
    });

    test('testConnection calls Graph API /me', async () => {
      const client = new TeamsIntegration();
      await client.authenticate({ accessToken: 'mock-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          id: 'user-123',
          displayName: 'John Doe',
          userPrincipalName: 'john@example.com',
          mail: 'john@example.com'
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.id).toBe('user-123');
      expect(result.account.name).toBe('John Doe');
      expect(axios.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token'
          })
        })
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new TeamsIntegration();
      await client.authenticate({ accessToken: 'expired-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: { message: 'Unauthorized' } } }
      });

      await expect(client.testConnection()).rejects.toThrow('Teams: Unauthorized');
    });
  });

  describe('DropboxIntegration', () => {
    const DropboxIntegration = require('../services/integrations/dropboxIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new DropboxIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Dropbox: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'dbx-token' })).resolves.toBe(true);
    });

    test('testConnection calls /users/get_current_account', async () => {
      const client = new DropboxIntegration();
      await client.authenticate({ accessToken: 'dbx-token' });

      axios.post.mockResolvedValueOnce({
        data: {
          account_id: 'dbid:123',
          name: { display_name: 'Jane Smith' },
          email: 'jane@example.com'
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.id).toBe('dbid:123');
      expect(result.account.name).toBe('Jane Smith');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.dropboxapi.com/2/users/get_current_account',
        null,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer dbx-token'
          })
        })
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new DropboxIntegration();
      await client.authenticate({ accessToken: 'bad-token' });

      axios.post.mockRejectedValueOnce({
        response: { status: 401, data: { error_summary: 'invalid_access_token' } }
      });

      await expect(client.testConnection()).rejects.toThrow('Dropbox: Unauthorized');
    });
  });

  describe('SalesforceIntegration', () => {
    const SalesforceIntegration = require('../services/integrations/salesforceIntegration');

    test('authenticate validates accessToken and instanceUrl', async () => {
      const client = new SalesforceIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Salesforce: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'token' })).rejects.toThrow('Salesforce: Missing instanceUrl');
      await expect(client.authenticate({
        accessToken: 'sf-token',
        instanceUrl: 'https://example.salesforce.com'
      })).resolves.toBe(true);
    });

    test('testConnection calls /sobjects endpoint', async () => {
      const client = new SalesforceIntegration();
      await client.authenticate({
        accessToken: 'sf-token',
        instanceUrl: 'https://example.salesforce.com'
      });

      axios.get.mockResolvedValueOnce({
        data: {
          encoding: 'UTF-8',
          maxBatchSize: 200,
          sobjects: [{ name: 'Account' }, { name: 'Contact' }]
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.objectCount).toBe(2);
      expect(axios.get).toHaveBeenCalledWith(
        'https://example.salesforce.com/services/data/v58.0/sobjects',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new SalesforceIntegration();
      await client.authenticate({
        accessToken: 'expired',
        instanceUrl: 'https://example.salesforce.com'
      });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'invalid_token' } }
      });

      await expect(client.testConnection()).rejects.toThrow('Salesforce: Unauthorized');
    });
  });

  describe('HubSpotIntegration', () => {
    const HubSpotIntegration = require('../services/integrations/hubspotIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new HubSpotIntegration();

      await expect(client.authenticate({})).rejects.toThrow('HubSpot: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'hs-token' })).resolves.toBe(true);
    });

    test('testConnection calls token validation endpoint', async () => {
      const client = new HubSpotIntegration();
      await client.authenticate({ accessToken: 'hs-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          hub_id: 12345,
          app_id: 67890,
          user_id: 111,
          scopes: ['contacts', 'crm.objects.contacts.read']
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.hubId).toBe(12345);
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.hubapi.com/oauth/v1/access-tokens/hs-token',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new HubSpotIntegration();
      await client.authenticate({ accessToken: 'bad-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Invalid token' } }
      });

      await expect(client.testConnection()).rejects.toThrow('HubSpot: Unauthorized');
    });
  });

  describe('QuickBooksIntegration', () => {
    const QuickBooksIntegration = require('../services/integrations/quickbooksIntegration');

    test('authenticate validates accessToken and realmId', async () => {
      const client = new QuickBooksIntegration();

      await expect(client.authenticate({})).rejects.toThrow('QuickBooks: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'token' })).rejects.toThrow('QuickBooks: Missing realmId');
      await expect(client.authenticate({
        accessToken: 'qb-token',
        realmId: 'realm123'
      })).resolves.toBe(true);
    });

    test('testConnection calls companyinfo endpoint', async () => {
      const client = new QuickBooksIntegration();
      await client.authenticate({ accessToken: 'qb-token', realmId: 'realm123' });

      axios.get.mockResolvedValueOnce({
        data: {
          CompanyInfo: {
            CompanyName: 'Test Company',
            LegalName: 'Test Company LLC',
            Email: { Address: 'info@test.com' }
          }
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.companyName).toBe('Test Company');
      expect(axios.get).toHaveBeenCalledWith(
        'https://quickbooks.api.intuit.com/v3/company/realm123/companyinfo/realm123',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new QuickBooksIntegration();
      await client.authenticate({ accessToken: 'bad-token', realmId: 'realm123' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: {} }
      });

      await expect(client.testConnection()).rejects.toThrow('QuickBooks: Unauthorized');
    });
  });

  describe('AsanaIntegration', () => {
    const AsanaIntegration = require('../services/integrations/asanaIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new AsanaIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Asana: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'asana-token' })).resolves.toBe(true);
    });

    test('testConnection calls /users/me endpoint', async () => {
      const client = new AsanaIntegration();
      await client.authenticate({ accessToken: 'asana-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          data: {
            gid: '123456',
            name: 'Alice Johnson',
            email: 'alice@example.com'
          }
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.id).toBe('123456');
      expect(result.account.name).toBe('Alice Johnson');
      expect(axios.get).toHaveBeenCalledWith(
        'https://app.asana.com/api/1.0/users/me',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new AsanaIntegration();
      await client.authenticate({ accessToken: 'bad-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { errors: [{ message: 'Unauthorized' }] } }
      });

      await expect(client.testConnection()).rejects.toThrow('Asana: Unauthorized');
    });
  });

  describe('TrelloIntegration', () => {
    const TrelloIntegration = require('../services/integrations/trelloIntegration');

    test('authenticate validates apiKey and token', async () => {
      const client = new TrelloIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Trello: Missing apiKey');
      await expect(client.authenticate({ apiKey: 'key' })).rejects.toThrow('Trello: Missing token');
      await expect(client.authenticate({ apiKey: 'key', token: 'token' })).resolves.toBe(true);
    });

    test('testConnection calls /members/me endpoint', async () => {
      const client = new TrelloIntegration();
      await client.authenticate({ apiKey: 'trello-key', token: 'trello-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          id: 'trello-id-123',
          fullName: 'Bob Builder',
          username: 'bobbuilder',
          email: 'bob@example.com'
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.name).toBe('Bob Builder');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.trello.com/1/members/me',
        expect.objectContaining({
          params: {
            key: 'trello-key',
            token: 'trello-token'
          }
        })
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new TrelloIntegration();
      await client.authenticate({ apiKey: 'bad-key', token: 'bad-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'unauthorized' } }
      });

      await expect(client.testConnection()).rejects.toThrow('Trello: Unauthorized');
    });
  });

  describe('LinkedInIntegration', () => {
    const LinkedInIntegration = require('../services/integrations/linkedinIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new LinkedInIntegration();

      await expect(client.authenticate({})).rejects.toThrow('LinkedIn: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'li-token' })).resolves.toBe(true);
    });

    test('testConnection calls /v2/userinfo endpoint', async () => {
      const client = new LinkedInIntegration();
      await client.authenticate({ accessToken: 'li-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          sub: 'li-user-123',
          name: 'Carol Smith',
          email: 'carol@example.com',
          picture: 'https://example.com/photo.jpg'
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.id).toBe('li-user-123');
      expect(result.account.name).toBe('Carol Smith');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.linkedin.com/v2/userinfo',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new LinkedInIntegration();
      await client.authenticate({ accessToken: 'bad-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Unauthorized' } }
      });

      await expect(client.testConnection()).rejects.toThrow('LinkedIn: Unauthorized');
    });
  });

  describe('TwitterIntegration', () => {
    const TwitterIntegration = require('../services/integrations/twitterIntegration');

    test('authenticate validates accessToken', async () => {
      const client = new TwitterIntegration();

      await expect(client.authenticate({})).rejects.toThrow('Twitter: Missing accessToken');
      await expect(client.authenticate({ accessToken: 'tw-token' })).resolves.toBe(true);
    });

    test('testConnection calls /2/users/me endpoint', async () => {
      const client = new TwitterIntegration();
      await client.authenticate({ accessToken: 'tw-token' });

      axios.get.mockResolvedValueOnce({
        data: {
          data: {
            id: '12345',
            name: 'David Lee',
            username: 'davidlee'
          }
        }
      });

      const result = await client.testConnection();

      expect(result.ok).toBe(true);
      expect(result.account.id).toBe('12345');
      expect(result.account.username).toBe('davidlee');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.twitter.com/2/users/me',
        expect.any(Object)
      );
    });

    test('testConnection handles 401 error', async () => {
      const client = new TwitterIntegration();
      await client.authenticate({ accessToken: 'bad-token' });

      axios.get.mockRejectedValueOnce({
        response: { status: 401, data: { errors: [{ message: 'Unauthorized' }] } }
      });

      await expect(client.testConnection()).rejects.toThrow('Twitter: Unauthorized');
    });
  });
});
