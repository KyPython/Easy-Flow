/**
 * Microsoft Teams (Microsoft Graph) Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET https://graph.microsoft.com/v1.0/me (benign, read-only)
 */

const axios = require('axios');

class TeamsIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Teams: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('Teams: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test using Microsoft Graph
   * Docs: https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0&tabs=http
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('Teams: Not authenticated');
    }

    try {
      const resp = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json'
        },
        timeout: 10000
      });

      const { id, displayName, userPrincipalName, mail } = resp?.data || {};
      return {
        ok: true,
        account: {
          id: id || null,
          name: displayName || null,
          upn: userPrincipalName || null,
          email: mail || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 401 || status === 403) {
        throw new Error('Teams: Unauthorized or insufficient permissions. Please reconnect and ensure proper Graph scopes.');
      }
      const message = (data && (data.error_description || data.error?.message)) || err.message || 'Teams: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = TeamsIntegration;
