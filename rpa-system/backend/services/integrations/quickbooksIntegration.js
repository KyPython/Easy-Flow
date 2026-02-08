/**
 * QuickBooks Integration Client
 * - OAuth 2.0 access token expected in credentials.accessToken
 * - testConnection calls GET /v3/company/{realmId}/companyinfo/{realmId} (benign, read-only)
 */

const axios = require('axios');

class QuickBooksIntegration {
  constructor() {
    this.token = null;
    this.realmId = null;
  }

  /**
   * Authenticate using provided credentials
   * @param {Object} credentials - { accessToken: string, realmId: string, refreshToken?: string }
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('QuickBooks: No credentials provided');
    }

    const token = credentials.accessToken || credentials.token;
    if (!token) {
      throw new Error('QuickBooks: Missing accessToken');
    }

    const realmId = credentials.realmId || credentials.realm_id;
    if (!realmId) {
      throw new Error('QuickBooks: Missing realmId');
    }

    this.token = token;
    this.realmId = realmId;
    return true;
  }

  /**
   * Benign connection test
   * Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/companyinfo
   */
  async testConnection() {
    if (!this.token || !this.realmId) {
      throw new Error('QuickBooks: Not authenticated');
    }

    try {
      const resp = await axios.get(
        `https://quickbooks.api.intuit.com/v3/company/${this.realmId}/companyinfo/${this.realmId}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );

      const companyInfo = resp?.data?.CompanyInfo || {};
      const { CompanyName, LegalName, Email } = companyInfo;
      return {
        ok: true,
        account: {
          realmId: this.realmId,
          companyName: CompanyName || null,
          legalName: LegalName || null,
          email: Email?.Address || null
        }
      };
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 401) {
        throw new Error('QuickBooks: Unauthorized (invalid or expired token). Please reconnect.');
      }

      const message = (data && (data.Fault?.Error?.[0]?.Message || data.error)) || err.message || 'QuickBooks: Connection failed';
      throw new Error(message);
    }
  }
}

module.exports = QuickBooksIntegration;
