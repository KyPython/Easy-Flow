/**
 * HubSpot Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /oauth/v1/access-tokens/{token} (benign, read-only)
 */

const axios = require('axios');

class HubSpotIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('HubSpot: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('HubSpot: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developers.hubspot.com/docs/api/oauth/tokens
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('HubSpot: Not authenticated');
    }

    try {
      const resp = await axios.get(
        `https://api.hubapi.com/oauth/v1/access-tokens/${this.token}`,
        {
          timeout: 10000
        }
      );

      const { hub_id, app_id, user_id, scopes } = resp?.data || {};
      return {
        ok: true,
        account: {
          hubId: hub_id || null,
          appId: app_id || null,
          userId: user_id || null,
          scopes: scopes || []
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401 || status === 403) {
        throw new Error('HubSpot: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.message || data.error)) || err.message || 'HubSpot: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = HubSpotIntegration;
