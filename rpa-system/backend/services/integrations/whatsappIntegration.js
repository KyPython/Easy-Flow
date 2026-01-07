/**
 * WhatsApp Integration for EasyFlow
 * Handles reading messages and collecting feedback from WhatsApp
 *
 * Note: WhatsApp Business API requires approval from Meta.
 * This integration supports:
 * - WhatsApp Business API (official, requires approval)
 * - Twilio WhatsApp API (easier to set up)
 */

const axios = require('axios');
const { logger } = require('../../utils/logger');
const { createInstrumentedHttpClient } = require('../../middleware/httpInstrumentation');

class WhatsAppIntegration {
  constructor(httpClient = null) {
    this.http = httpClient || createInstrumentedHttpClient();
    this.provider = null; // 'twilio' or 'meta'
    this.credentials = null;
  }

  /**
   * Authenticate with WhatsApp
   * @param {Object} credentials - Provider-specific credentials
   *   For Twilio: { provider: 'twilio', accountSid, authToken, fromNumber }
   *   For Meta: { provider: 'meta', accessToken, phoneNumberId, businessAccountId }
   */
  async authenticate(credentials) {
    this.credentials = credentials;
    this.provider = credentials.provider || 'twilio';

    if (this.provider === 'twilio') {
      // Verify Twilio credentials
      if (!credentials.accountSid || !credentials.authToken) {
        throw new Error('Twilio credentials missing: accountSid and authToken required');
      }
      logger.info('[WhatsAppIntegration] Authenticated with Twilio');
    } else if (this.provider === 'meta') {
      // Verify Meta credentials
      if (!credentials.accessToken || !credentials.phoneNumberId) {
        throw new Error('Meta credentials missing: accessToken and phoneNumberId required');
      }
      logger.info('[WhatsAppIntegration] Authenticated with Meta WhatsApp Business API');
    } else {
      throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Send a WhatsApp message
   * @param {Object} data - { to, message, mediaUrl? }
   */
  async sendMessage(data) {
    const { to, message, mediaUrl = null } = data;

    if (this.provider === 'twilio') {
      return this._sendViaTwilio(to, message, mediaUrl);
    } else if (this.provider === 'meta') {
      return this._sendViaMeta(to, message, mediaUrl);
    }
  }

  /**
   * Send message via Twilio
   * @private
   */
  async _sendViaTwilio(to, message, mediaUrl) {
    const { accountSid, authToken, fromNumber } = this.credentials;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${fromNumber}`);
    formData.append('To', `whatsapp:${to}`);
    formData.append('Body', message);
    if (mediaUrl) formData.append('MediaUrl', mediaUrl);

    const response = await this.http.post(url, formData, {
      auth: {
        username: accountSid,
        password: authToken
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return {
      success: true,
      messageId: response.data.sid,
      status: response.data.status
    };
  }

  /**
   * Send message via Meta WhatsApp Business API
   * @private
   */
  async _sendViaMeta(to, message, mediaUrl) {
    const { accessToken, phoneNumberId } = this.credentials;

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/[^0-9]/g, ''), // Remove non-digits
      type: mediaUrl ? 'template' : 'text',
      text: mediaUrl ? undefined : { body: message }
    };

    if (mediaUrl) {
      payload.template = {
        name: 'text_message',
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: [{ type: 'text', text: message }]
        }]
      };
    }

    const response = await this.http.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: true,
      messageId: response.data.messages[0]?.id,
      status: 'sent'
    };
  }

  /**
   * Read messages (webhook-based)
   * Note: WhatsApp doesn't have a direct "read messages" API.
   * Messages are received via webhooks. This method processes webhook payloads.
   * @param {Object} webhookPayload - Webhook payload from Twilio or Meta
   */
  async processWebhook(webhookPayload) {
    if (this.provider === 'twilio') {
      return this._processTwilioWebhook(webhookPayload);
    } else if (this.provider === 'meta') {
      return this._processMetaWebhook(webhookPayload);
    }
  }

  /**
   * Process Twilio webhook
   * @private
   */
  _processTwilioWebhook(payload) {
    return {
      success: true,
      message: {
        id: payload.MessageSid,
        from: payload.From?.replace('whatsapp:', ''),
        to: payload.To?.replace('whatsapp:', ''),
        body: payload.Body,
        timestamp: payload.Timestamp,
        mediaUrl: payload.MediaUrl0
      }
    };
  }

  /**
   * Process Meta webhook
   * @private
   */
  _processMetaWebhook(payload) {
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return { success: false, error: 'No message in webhook payload' };
    }

    return {
      success: true,
      message: {
        id: message.id,
        from: message.from,
        to: value.metadata?.phone_number_id,
        body: message.text?.body || message.type,
        timestamp: message.timestamp,
        type: message.type
      }
    };
  }

  /**
   * Collect feedback from messages
   * Filters messages that contain feedback keywords
   * @param {Array} messages - Array of message objects
   * @param {Object} options - { keywords? }
   */
  async collectFeedback(messages, options = {}) {
    const { keywords = ['feedback', 'suggestion', 'improve', 'issue', 'problem', 'love', 'hate'] } = options;

    const feedback = messages
      .filter(msg => {
        const text = (msg.body || '').toLowerCase();
        return keywords.some(keyword => text.includes(keyword.toLowerCase()));
      })
      .map(msg => ({
        id: msg.id,
        from: msg.from,
        text: msg.body,
        timestamp: msg.timestamp,
        source: 'whatsapp'
      }));

    return {
      success: true,
      feedback,
      count: feedback.length
    };
  }

  /**
   * Send data to WhatsApp (alias for sendMessage for compatibility)
   */
  async sendData(data) {
    return this.sendMessage(data);
  }
}

module.exports = WhatsAppIntegration;

