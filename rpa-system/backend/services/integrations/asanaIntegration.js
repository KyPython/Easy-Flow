/**
 * Asana Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /users/me (benign, read-only)
 */

const axios = require('axios');

class AsanaIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Asana: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('Asana: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developers.asana.com/docs/get-a-user
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('Asana: Not authenticated');
    }

    try {
      const resp = await axios.get(
        'https://app.asana.com/api/1.0/users/me',
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );

      const user = resp?.data?.data || {};
      const { gid, name, email } = user;
      return {
        ok: true,
        account: {
          id: gid || null,
          name: name || null,
          email: email || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('Asana: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.errors?.[0]?.message || data.error)) || err.message || 'Asana: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = AsanaIntegration;
