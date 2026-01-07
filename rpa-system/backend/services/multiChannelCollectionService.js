/**
 * Multi-Channel Collection Service
 * Automatically collects feedback from multiple sources and compiles them
 */

const { logger } = require('../utils/logger');
const SlackIntegration = require('./integrations/slackIntegration');
const GmailIntegration = require('./integrations/gmailIntegration');
const WhatsAppIntegration = require('./integrations/whatsappIntegration');
const GoogleMeetIntegration = require('./integrations/googleMeetIntegration');
const GoogleSheetsIntegration = require('./integrations/googleSheetsIntegration');
const TranscriptionService = require('./integrations/transcriptionService');

class MultiChannelCollectionService {
  constructor() {
    this.slack = null;
    this.gmail = null;
    this.whatsapp = null;
    this.meet = null;
    this.sheets = null;
    this.transcription = new TranscriptionService();
  }

  /**
   * Initialize integrations with credentials
   * @param {Object} credentials - { slack?, gmail?, whatsapp?, meet?, sheets? }
   */
  async initialize(credentials) {
    if (credentials.slack) {
      this.slack = new SlackIntegration();
      await this.slack.authenticate(credentials.slack);
    }

    if (credentials.gmail) {
      this.gmail = new GmailIntegration();
      await this.gmail.authenticate(credentials.gmail);
    }

    if (credentials.whatsapp) {
      this.whatsapp = new WhatsAppIntegration();
      await this.whatsapp.authenticate(credentials.whatsapp);
    }

    if (credentials.meet) {
      this.meet = new GoogleMeetIntegration();
      await this.meet.authenticate(credentials.meet);
    }

    if (credentials.sheets) {
      this.sheets = new GoogleSheetsIntegration();
      await this.sheets.authenticate(credentials.sheets);
    }

    logger.info('[MultiChannelCollection] Initialized with available integrations');
  }

  /**
   * Collect feedback from all configured channels
   * @param {Object} params - Collection parameters
   */
  async collectFromAllChannels(params = {}) {
    const {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      keywords = ['feedback', 'suggestion', 'improve', 'issue', 'problem', 'love', 'hate'],
      channels = {},
      includeTranscriptions = false
    } = params;

    const allFeedback = [];

    // Collect from Slack
    if (this.slack && channels.slack) {
      try {
        const slackFeedback = await this.slack.collectFeedback({
          channel: channels.slack.channel || '#general',
          keywords,
          since
        });

        allFeedback.push(...slackFeedback.feedback.map(f => ({
          ...f,
          source: 'slack',
          channel: channels.slack.channel
        })));
      } catch (error) {
        logger.error('[MultiChannelCollection] Slack collection failed:', error);
      }
    }

    // Collect from Gmail
    if (this.gmail && channels.gmail) {
      try {
        const gmailFeedback = await this.gmail.collectFeedback({
          keywords,
          since,
          maxResults: channels.gmail.maxResults || 50
        });

        allFeedback.push(...gmailFeedback.feedback.map(f => ({
          ...f,
          source: 'gmail'
        })));
      } catch (error) {
        logger.error('[MultiChannelCollection] Gmail collection failed:', error);
      }
    }

    // Collect from WhatsApp (requires webhook messages to be passed)
    if (this.whatsapp && channels.whatsapp && channels.whatsapp.messages) {
      try {
        const whatsappFeedback = await this.whatsapp.collectFeedback(
          channels.whatsapp.messages,
          { keywords }
        );

        allFeedback.push(...whatsappFeedback.feedback);
      } catch (error) {
        logger.error('[MultiChannelCollection] WhatsApp collection failed:', error);
      }
    }

    // Collect from Google Meet recordings
    if (this.meet && channels.meet && includeTranscriptions) {
      try {
        const recordings = await this.meet.processRecordings({
          since,
          extractInsights: true
        });

        recordings.results.forEach(result => {
          if (result.success && result.insights) {
            result.insights.forEach(insight => {
              allFeedback.push({
                id: `meet-${result.recording.id}-${insight.insight}`,
                source: 'google-meet',
                text: insight.insight,
                timestamp: result.recording.createdTime,
                category: insight.category,
                sentiment: insight.sentiment,
                priority: insight.priority,
                transcription: result.transcription
              });
            });
          }
        });
      } catch (error) {
        logger.error('[MultiChannelCollection] Meet collection failed:', error);
      }
    }

    // Sort by timestamp (newest first)
    allFeedback.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    return {
      success: true,
      feedback: allFeedback,
      count: allFeedback.length,
      sources: {
        slack: allFeedback.filter(f => f.source === 'slack').length,
        gmail: allFeedback.filter(f => f.source === 'gmail').length,
        whatsapp: allFeedback.filter(f => f.source === 'whatsapp').length,
        'google-meet': allFeedback.filter(f => f.source === 'google-meet').length
      }
    };
  }

  /**
   * Compile feedback into Google Sheets
   * @param {Object} params - { spreadsheetId, feedback, sheetName? }
   */
  async compileToSheet(params) {
    const { spreadsheetId, feedback, sheetName = 'Customer Feedback' } = params;

    if (!this.sheets) {
      throw new Error('Google Sheets integration not initialized');
    }

    return await this.sheets.compileFeedback({
      spreadsheetId,
      feedback,
      sheetName
    });
  }

  /**
   * Generate summary report from collected feedback
   * @param {Array} feedback - Array of feedback items
   */
  async generateSummary(feedback) {
    // Group by source
    const bySource = feedback.reduce((acc, item) => {
      const source = item.source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(item);
      return acc;
    }, {});

    // Group by sentiment
    const bySentiment = feedback.reduce((acc, item) => {
      const sentiment = item.sentiment || 'neutral';
      if (!acc[sentiment]) acc[sentiment] = [];
      acc[sentiment].push(item);
      return acc;
    }, {});

    // Group by category (if available)
    const byCategory = feedback.reduce((acc, item) => {
      const category = item.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    return {
      total: feedback.length,
      bySource: Object.keys(bySource).map(source => ({
        source,
        count: bySource[source].length,
        percentage: ((bySource[source].length / feedback.length) * 100).toFixed(1)
      })),
      bySentiment: Object.keys(bySentiment).map(sentiment => ({
        sentiment,
        count: bySentiment[sentiment].length,
        percentage: ((bySentiment[sentiment].length / feedback.length) * 100).toFixed(1)
      })),
      byCategory: Object.keys(byCategory).map(category => ({
        category,
        count: byCategory[category].length
      })),
      timeRange: {
        oldest: feedback.length > 0 ? feedback[feedback.length - 1].timestamp : null,
        newest: feedback.length > 0 ? feedback[0].timestamp : null
      }
    };
  }

  /**
   * Complete workflow: Collect -> Compile -> Summarize
   * @param {Object} params - Full collection and compilation parameters
   */
  async collectAndCompile(params) {
    const {
      collectionParams = {},
      spreadsheetId,
      sheetName = 'Customer Feedback',
      generateSummary = true
    } = params;

    // Collect from all channels
    const collectionResult = await this.collectFromAllChannels(collectionParams);

    // Compile to sheet if spreadsheet ID provided
    let compileResult = null;
    if (spreadsheetId && this.sheets) {
      compileResult = await this.compileToSheet({
        spreadsheetId,
        feedback: collectionResult.feedback,
        sheetName
      });
    }

    // Generate summary
    let summary = null;
    if (generateSummary) {
      summary = await this.generateSummary(collectionResult.feedback);
    }

    return {
      success: true,
      collection: collectionResult,
      compilation: compileResult,
      summary
    };
  }
}

module.exports = MultiChannelCollectionService;

