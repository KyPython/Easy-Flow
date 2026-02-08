/**
 * Trello Integration Client
 * - API Key + Token authentication
 * - testConnection calls GET /1/members/me (benign, read-only)
 */

const axios = require('axios');

class TrelloIntegration {
  constructor() {
    this.apiKey = null;
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { apiKey: string, token: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Trello: No credentials provided');
    }

    const apiKey = credentials.apiKey || credentials.api_key || credentials.key;
    if (!apiKey) {
      throw new Error('Trello: Missing apiKey');
    }

    const token = credentials.token || credentials.accessToken;
    if (!token) {
      throw new Error('Trello: Missing token');
    }

    this.apiKey = apiKey;
    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-get
   */
  async testConnection() {
    if (!this.apiKey || !this.token) {
      throw new Error('Trello: Not authenticated');
    }

    try {
      const resp = await axios.get(
        'https://api.trello.com/1/members/me',
        {
          params: {
            key: this.apiKey,
            token: this.token
          },
          timeout: 10000
        }
      );

      const { id, fullName, username, email } = resp?.data || {};
      return {
        ok: true,
        account: {
          id: id || null,
          name: fullName || null,
          username: username || null,
          email: email || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('Trello: Unauthorized (invalid API key or token). Please reconnect.');
      }

      const message = (data && (data.message || data.error)) || err.message || 'Trello: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = TrelloIntegration;
