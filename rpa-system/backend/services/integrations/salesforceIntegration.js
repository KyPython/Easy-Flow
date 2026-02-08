/**
 * Salesforce Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /services/data/v58.0/sobjects (benign, read-only)
 */

const axios = require('axios');

class SalesforceIntegration {
  constructor() {
    this.token = null;
    this.instanceUrl = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, instanceUrl: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Salesforce: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('Salesforce: Missing accessToken');
    }

    const instanceUrl = credentials.instanceUrl || credentials.instance_url;
    if (!instanceUrl) {
      throw new Error('Salesforce: Missing instanceUrl');
    }

    this.token = token;
    this.instanceUrl = instanceUrl;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_describeGlobal.htm
   */
  async testConnection() {
    if (!this.token || !this.instanceUrl) {
      throw new Error('Salesforce: Not authenticated');
    }

    try {
      const resp = await axios.get(
        `${this.instanceUrl}/services/data/v58.0/sobjects`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const { encoding, maxBatchSize, sobjects } = resp?.data || {};
      return {
        ok: true,
        account: {
          instanceUrl: this.instanceUrl,
          encoding: encoding || null,
          maxBatchSize: maxBatchSize || null,
          objectCount: sobjects?.length || 0
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('Salesforce: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.error_description || data.error)) || err.message || 'Salesforce: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = SalesforceIntegration;
