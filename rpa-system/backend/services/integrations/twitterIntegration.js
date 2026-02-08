/**
 * Twitter Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /2/users/me (benign, read-only)
 */

const axios = require('axios');

class TwitterIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Twitter: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('Twitter: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developer.twitter.com/en/docs/twitter-api/users/lookup/api-reference/get-users-me
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('Twitter: Not authenticated');
    }

    try {
      const resp = await axios.get(
        'https://api.twitter.com/2/users/me',
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );

      const user = resp?.data?.data || {};
      const { id, name, username } = user;
      return {
        ok: true,
        account: {
          id: id || null,
          name: name || null,
          username: username || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('Twitter: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.errors?.[0]?.message || data.error)) || err.message || 'Twitter: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = TwitterIntegration;
