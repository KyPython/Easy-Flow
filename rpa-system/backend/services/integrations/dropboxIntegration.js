/**
 * Dropbox Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls /2/users/get_current_account (benign, read-only)
 */

const axios = require('axios');

class DropboxIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Dropbox: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('Dropbox: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://www.dropbox.com/developers/documentation/http/documentation#users-get_current_account
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('Dropbox: Not authenticated');
    }

    try {
      const resp = await axios.post(
        'https://api.dropboxapi.com/2/users/get_current_account',
        null,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const { name, email, account_id } = resp?.data || {};
      return {
        ok: true,
        account: {
          id: account_id,
          name: name?.display_name || null,
          email: email || null
        }
      };
    } catch (err) {
      // Normalize Dropbox errors
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('Dropbox: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.error_summary || data.error_description)) || err.message || 'Dropbox: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = DropboxIntegration;
