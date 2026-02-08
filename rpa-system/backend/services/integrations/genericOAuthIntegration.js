/**
 * Generic OAuth Integration Stub
 * - Provides minimal authenticate() and testConnection() methods
 * - Validates that some credentials are present (accessToken, token, apiKey, clientId, etc.)
 * - Intended as a temporary stub for providers until full clients are implemented
 */

class GenericOAuthIntegration {
  constructor() {
    this.credentials = null;
  }

  /**
   * Authenticate using provided credentials.
   * Accepts a broad set of shapes to accommodate different providers.
   */
  async authenticate(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No credentials provided');
    }

    const hasTokenLike = Boolean(
      credentials.accessToken ||
      credentials.botToken ||
      credentials.token ||
      credentials.apiKey ||
      credentials.api_key ||
      credentials.refreshToken ||
      credentials.clientId ||
      credentials.client_id ||
      credentials.workspaceId ||
      credentials.instanceUrl ||
      credentials.instance_url
    );

    if (!hasTokenLike) {
      throw new Error('Credentials are missing required token or key');
    }

    this.credentials = credentials;
    return true;
  }

  /**
   * Benign connection check
   * For a stub, simply returns ok: true when credentials are present.
   */
  async testConnection() {
    if (!this.credentials) {
      throw new Error('Not authenticated');
    }
    return { ok: true, message: 'Generic integration stub connection OK' };
  }
}

module.exports = GenericOAuthIntegration;
