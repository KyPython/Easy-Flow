/**
 * Slack Integration for EasyFlow
 * Handles reading messages, sending messages, and collecting feedback from Slack
 */

const axios = require('axios');
const { logger } = require('../../utils/logger');
const { createInstrumentedHttpClient } = require('../../middleware/httpInstrumentation');

class SlackIntegration {
  constructor(httpClient = null) {
    this.baseUrl = 'https://slack.com/api';
    this.http = httpClient || createInstrumentedHttpClient();
    this.accessToken = null;
    this.botToken = null;
  }

  /**
   * Authenticate with Slack
   * @param {Object} credentials - { accessToken, botToken }
   */
  async authenticate(credentials) {
    this.accessToken = credentials.accessToken || credentials.botToken;
    this.botToken = credentials.botToken || credentials.accessToken;
    
    // Verify token works
    const test = await this.http.post(
      `${this.baseUrl}/auth.test`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!test.data.ok) {
      throw new Error(`Slack authentication failed: ${test.data.error}`);
    }
    
    logger.info('[SlackIntegration] Authenticated successfully', {
      team: test.data.team,
      user: test.data.user
    });
  }

  /**
   * Send a message to a Slack channel
   * @param {Object} data - { channel, text, attachments?, blocks? }
   */
  async sendMessage(data) {
    const { channel, text, attachments = [], blocks = [] } = data;
    
    const response = await this.http.post(
      `${this.baseUrl}/chat.postMessage`,
      {
        channel: channel.startsWith('#') ? channel : `#${channel}`,
        text,
        attachments,
        blocks
      },
      {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return {
      success: true,
      ts: response.data.ts,
      channel: response.data.channel,
      message: response.data.message
    };
  }

  /**
   * Read messages from a Slack channel
   * @param {Object} params - { channel, limit?, oldest?, latest? }
   */
  async readMessages(params) {
    const { channel, limit = 100, oldest = null, latest = null } = params;
    
    const queryParams = {
      channel: channel.startsWith('#') ? channel.slice(1) : channel,
      limit
    };
    
    if (oldest) queryParams.oldest = oldest;
    if (latest) queryParams.latest = latest;
    
    const response = await this.http.get(
      `${this.baseUrl}/conversations.history`,
      {
        params: queryParams,
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return {
      success: true,
      messages: response.data.messages || [],
      hasMore: response.data.has_more || false,
      nextCursor: response.data.response_metadata?.next_cursor
    };
  }

  /**
   * List all channels in the workspace
   */
  async listChannels() {
    const response = await this.http.get(
      `${this.baseUrl}/conversations.list`,
      {
        params: {
          types: 'public_channel,private_channel',
          exclude_archived: true
        },
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return {
      success: true,
      channels: response.data.channels || []
    };
  }

  /**
   * Collect feedback from Slack messages
   * Filters messages that contain feedback keywords
   * @param {Object} params - { channel, keywords?, since? }
   */
  async collectFeedback(params) {
    const { channel, keywords = ['feedback', 'suggestion', 'improve', 'issue', 'problem', 'love', 'hate'], since = null } = params;
    
    // Get messages from the last 7 days if since not specified
    const oldest = since || (Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)).toString();
    
    const messagesResult = await this.readMessages({ channel, oldest, limit: 200 });
    
    // Filter messages containing feedback keywords
    const feedbackMessages = messagesResult.messages.filter(msg => {
      const text = (msg.text || '').toLowerCase();
      return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });
    
    // Extract structured feedback
    const feedback = feedbackMessages.map(msg => ({
      id: msg.ts,
      channel,
      text: msg.text,
      user: msg.user,
      timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
      reactions: msg.reactions || [],
      threadReplies: msg.reply_count || 0
    }));
    
    return {
      success: true,
      feedback,
      count: feedback.length,
      channel
    };
  }

  /**
   * Upload a file to Slack
   * @param {Object} file - { name, buffer, mimetype }
   * @param {Object} settings - { channel, title?, initialComment? }
   */
  async uploadFile(file, settings) {
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', file.buffer, {
      filename: file.name,
      contentType: file.mimetype || 'application/octet-stream'
    });
    formData.append('channels', settings.channel.startsWith('#') ? settings.channel.slice(1) : settings.channel);
    if (settings.title) formData.append('title', settings.title);
    if (settings.initialComment) formData.append('initial_comment', settings.initialComment);
    
    const response = await this.http.post(
      `${this.baseUrl}/files.upload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          ...formData.getHeaders()
        }
      }
    );
    
    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
    
    return {
      success: true,
      file: response.data.file,
      id: response.data.file?.id
    };
  }

  /**
   * Send data to Slack (alias for sendMessage for compatibility)
   */
  async sendData(data) {
    return this.sendMessage(data);
  }
}

module.exports = SlackIntegration;

