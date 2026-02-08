/**
 * LinkedIn Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /v2/userinfo (benign, read-only)
 */

const axios = require('axios');

class LinkedInIntegration {
  constructor() {
    this.token = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('LinkedIn: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('LinkedIn: Missing accessToken');
    }

    this.token = token;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
   */
  async testConnection() {
    if (!this.token) {
      throw new Error('LinkedIn: Not authenticated');
    }

    try {
      const resp = await axios.get(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );

      const { sub, name, email, picture } = resp?.data || {};
      return {
        ok: true,
        account: {
          id: sub || null,
          name: name || null,
          email: email || null,
          picture: picture || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('LinkedIn: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.message || data.error)) || err.message || 'LinkedIn: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = LinkedInIntegration;
