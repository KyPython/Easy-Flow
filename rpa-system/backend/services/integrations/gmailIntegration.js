/**
 * Gmail Integration for EasyFlow
 * Handles reading emails, sending emails, and extracting attachments
 */

const { google } = require('googleapis');
const { logger } = require('../../utils/logger');

class GmailIntegration {
  constructor() {
    this.gmail = null;
    this.oauth2Client = null;
  }

  /**
   * Authenticate with Gmail
   * @param {Object} credentials - { accessToken, refreshToken, clientId, clientSecret }
   */
  async authenticate(credentials) {
    const { accessToken, refreshToken, clientId, clientSecret } = credentials;
    
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
    );
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    // Refresh token if needed
    if (!accessToken && refreshToken) {
      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(newCredentials);
    }
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    // Verify authentication
    try {
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      logger.info('[GmailIntegration] Authenticated successfully', {
        email: profile.data.emailAddress
      });
    } catch (error) {
      // Provide helpful error messages for common issues
      let errorMessage = error.message;
      
      if (error.message?.includes('has not been used') || error.message?.includes('is disabled')) {
        // Extract project ID from error message if available
        const projectIdMatch = error.message.match(/project (\d+)/);
        const projectId = projectIdMatch ? projectIdMatch[1] : 'your-project';
        
        errorMessage = `Gmail API is not enabled in your Google Cloud project. ` +
          `Please enable it at: https://console.cloud.google.com/apis/api/gmail.googleapis.com/overview?project=${projectId} ` +
          `If you just enabled it, wait a few minutes and try again.`;
      } else if (error.message?.includes('invalid_grant') || error.message?.includes('token')) {
        errorMessage = `Gmail authentication token expired or invalid. Please reconnect the integration.`;
      } else if (error.message?.includes('insufficient')) {
        errorMessage = `Insufficient permissions for Gmail. Please reconnect and grant all required permissions.`;
      }
      
      logger.error('[GmailIntegration] Authentication failed:', {
        error: error.message,
        code: error.code
      });
      
      throw new Error(`Gmail authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Send an email
   * @param {Object} data - { to, subject, body, html?, attachments? }
   */
  async sendEmail(data) {
    const { to, subject, body, html, attachments = [] } = data;
    
    // Build email message
    const messageParts = [];
    
    // Headers
    messageParts.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
    messageParts.push(`Subject: ${subject}`);
    messageParts.push('Content-Type: text/html; charset=utf-8');
    messageParts.push('');
    
    // Body
    messageParts.push(html || body.replace(/\n/g, '<br>'));
    
    // Create message
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    return {
      success: true,
      id: response.data.id,
      threadId: response.data.threadId
    };
  }

  /**
   * Read emails from inbox
   * @param {Object} params - { query?, maxResults?, labelIds? }
   */
  async readEmails(params = {}) {
    const { query = '', maxResults = 10, labelIds = ['INBOX'] } = params;
    
    // List messages
    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
      labelIds
    });
    
    const messages = listResponse.data.messages || [];
    
    // Get full message details
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        const messageResponse = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });
        
        return this._parseMessage(messageResponse.data);
      })
    );
    
    return {
      success: true,
      emails: emailDetails,
      count: emailDetails.length
    };
  }

  /**
   * Extract attachments from an email
   * @param {String} messageId - Gmail message ID
   */
  async extractAttachments(messageId) {
    const messageResponse = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    const attachments = [];
    const parts = messageResponse.data.payload?.parts || [];
    
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const attachmentResponse = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: part.body.attachmentId
        });
        
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
          data: Buffer.from(attachmentResponse.data.data, 'base64')
        });
      }
    }
    
    return {
      success: true,
      attachments,
      count: attachments.length
    };
  }

  /**
   * Collect feedback from emails
   * Filters emails that contain feedback keywords
   * @param {Object} params - { keywords?, since?, maxResults? }
   */
  async collectFeedback(params = {}) {
    const { 
      keywords = ['feedback', 'suggestion', 'improve', 'issue', 'problem', 'love', 'hate', 'review'],
      since = null,
      maxResults = 50
    } = params;
    
    // Build query
    let query = keywords.map(k => `"${k}"`).join(' OR ');
    if (since) {
      query += ` after:${Math.floor(new Date(since).getTime() / 1000)}`;
    }
    
    const emailsResult = await this.readEmails({ query, maxResults });
    
    // Extract structured feedback
    const feedback = emailsResult.emails.map(email => ({
      id: email.id,
      from: email.from,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      timestamp: email.timestamp,
      attachments: email.hasAttachments
    }));
    
    return {
      success: true,
      feedback,
      count: feedback.length
    };
  }

  /**
   * Parse Gmail message into structured format
   * @private
   */
  _parseMessage(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    // Extract body
    let body = '';
    let html = '';
    const parts = message.payload?.parts || [];
    
    const extractBody = (part) => {
      if (part.body?.data) {
        const data = Buffer.from(part.body.data, 'base64').toString('utf-8');
        if (part.mimeType === 'text/html') {
          html = data;
        } else if (part.mimeType === 'text/plain') {
          body = data;
        }
      }
      
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };
    
    if (message.payload.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }
    
    parts.forEach(extractBody);
    
    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      timestamp: new Date(parseInt(message.internalDate)).toISOString(),
      body: body || html.replace(/<[^>]*>/g, ''),
      html: html || body,
      snippet: message.snippet,
      hasAttachments: parts.some(p => p.filename && p.body?.attachmentId),
      labels: message.labelIds || []
    };
  }

  /**
   * Send data to Gmail (alias for sendEmail for compatibility)
   */
  async sendData(data) {
    return this.sendEmail(data);
  }
}

module.exports = GmailIntegration;

