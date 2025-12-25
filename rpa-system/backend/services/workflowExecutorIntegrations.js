/**
 * Integration Action Handlers for Workflow Executor
 * Handles all integration-related workflow steps
 */

const { logger } = require('../utils/logger');
const integrationCredentialsService = require('./integrationCredentialsService');
const SlackIntegration = require('./integrations/slackIntegration');
const GmailIntegration = require('./integrations/gmailIntegration');
const GoogleSheetsIntegration = require('./integrations/googleSheetsIntegration');
const GoogleMeetIntegration = require('./integrations/googleMeetIntegration');
const WhatsAppIntegration = require('./integrations/whatsappIntegration');
const MultiChannelCollectionService = require('./multiChannelCollectionService');

/**
 * Execute Slack actions
 */
async function executeSlackAction(actionType, config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for Slack integration');
  }
  
  // Get credentials
  const credentials = await integrationCredentialsService.getCredentials(userId, 'slack');
  if (!credentials) {
    throw new Error('Slack integration not connected. Please connect Slack in Settings.');
  }
  
  const slack = new SlackIntegration();
  await slack.authenticate(credentials.credentials);
  
  // Update last used
  await integrationCredentialsService.updateLastUsed(credentials.id);
  
  try {
    switch (actionType) {
      case 'slack_send':
        const sendResult = await slack.sendMessage({
          channel: config.channel,
          text: config.message,
          attachments: config.attachments,
          blocks: config.blocks
        });
        return {
          success: true,
          data: sendResult,
          message: `Message sent to ${config.channel}`
        };
      
      case 'slack_read':
        const readResult = await slack.readMessages({
          channel: config.channel,
          limit: config.limit || 100,
          oldest: config.oldest,
          latest: config.latest
        });
        return {
          success: true,
          data: readResult,
          message: `Read ${readResult.messages.length} messages from ${config.channel}`
        };
      
      case 'slack_collect_feedback':
        const feedbackResult = await slack.collectFeedback({
          channel: config.channel,
          keywords: config.keywords || ['feedback', 'suggestion'],
          since: config.since
        });
        return {
          success: true,
          data: feedbackResult,
          message: `Collected ${feedbackResult.count} feedback items from ${config.channel}`
        };
      
      default:
        throw new Error(`Unknown Slack action: ${actionType}`);
    }
  } catch (error) {
    logger.error(`[WorkflowExecutor] Slack action failed (${actionType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute Gmail actions
 */
async function executeGmailAction(actionType, config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for Gmail integration');
  }
  
  // Get credentials
  const credentials = await integrationCredentialsService.getCredentials(userId, 'gmail');
  if (!credentials) {
    throw new Error('Gmail integration not connected. Please connect Gmail in Settings.');
  }
  
  const gmail = new GmailIntegration();
  await gmail.authenticate(credentials.credentials);
  
  // Update last used
  await integrationCredentialsService.updateLastUsed(credentials.id);
  
  try {
    switch (actionType) {
      case 'gmail_send':
        const sendResult = await gmail.sendEmail({
          to: config.to,
          subject: config.subject,
          body: config.body,
          html: config.html,
          attachments: config.attachments
        });
        return {
          success: true,
          data: sendResult,
          message: `Email sent to ${Array.isArray(config.to) ? config.to.join(', ') : config.to}`
        };
      
      case 'gmail_read':
        const readResult = await gmail.readEmails({
          query: config.query,
          maxResults: config.maxResults || 10,
          labelIds: config.labelIds || ['INBOX']
        });
        return {
          success: true,
          data: readResult,
          message: `Read ${readResult.count} emails`
        };
      
      case 'gmail_collect_feedback':
        const feedbackResult = await gmail.collectFeedback({
          keywords: config.keywords || ['feedback', 'suggestion'],
          since: config.since,
          maxResults: config.maxResults || 50
        });
        return {
          success: true,
          data: feedbackResult,
          message: `Collected ${feedbackResult.count} feedback emails`
        };
      
      default:
        throw new Error(`Unknown Gmail action: ${actionType}`);
    }
  } catch (error) {
    logger.error(`[WorkflowExecutor] Gmail action failed (${actionType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute Google Sheets actions
 */
async function executeSheetsAction(actionType, config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for Google Sheets integration');
  }
  
  // Get credentials
  const credentials = await integrationCredentialsService.getCredentials(userId, 'google_sheets');
  if (!credentials) {
    throw new Error('Google Sheets integration not connected. Please connect Google Sheets in Settings.');
  }
  
  const sheets = new GoogleSheetsIntegration();
  await sheets.authenticate(credentials.credentials);
  
  // Update last used
  await integrationCredentialsService.updateLastUsed(credentials.id);
  
  try {
    switch (actionType) {
      case 'sheets_read':
        const readResult = await sheets.readData({
          spreadsheetId: config.spreadsheetId,
          range: config.range,
          sheetName: config.sheetName
        });
        return {
          success: true,
          data: readResult,
          message: `Read ${readResult.data.length} rows from sheet`
        };
      
      case 'sheets_write':
        const writeResult = await sheets.writeData({
          spreadsheetId: config.spreadsheetId,
          range: config.range,
          values: config.values,
          sheetName: config.sheetName
        });
        return {
          success: true,
          data: writeResult,
          message: `Wrote data to sheet`
        };
      
      case 'sheets_compile_feedback':
        // Get feedback from inputData or previous steps
        const feedback = config.feedback || inputData.feedback || [];
        const compileResult = await sheets.compileFeedback({
          spreadsheetId: config.spreadsheetId,
          feedback,
          sheetName: config.sheetName || 'Feedback'
        });
        return {
          success: true,
          data: compileResult,
          message: `Compiled ${feedback.length} feedback items to sheet`
        };
      
      default:
        throw new Error(`Unknown Sheets action: ${actionType}`);
    }
  } catch (error) {
    logger.error(`[WorkflowExecutor] Sheets action failed (${actionType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute Google Meet actions
 */
async function executeMeetAction(actionType, config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for Google Meet integration');
  }
  
  // Get credentials
  const credentials = await integrationCredentialsService.getCredentials(userId, 'google_meet');
  if (!credentials) {
    throw new Error('Google Meet integration not connected. Please connect Google Meet in Settings.');
  }
  
  const meet = new GoogleMeetIntegration();
  await meet.authenticate(credentials.credentials);
  
  // Update last used
  await integrationCredentialsService.updateLastUsed(credentials.id);
  
  try {
    switch (actionType) {
      case 'meet_transcribe':
        const transcribeResult = await meet.transcribeRecording(config.fileId);
        return {
          success: true,
          data: transcribeResult,
          message: `Transcribed recording: ${transcribeResult.fileName}`
        };
      
      case 'meet_process_recordings':
        const processResult = await meet.processRecordings({
          since: config.since,
          extractInsights: config.extractInsights || false
        });
        return {
          success: true,
          data: processResult,
          message: `Processed ${processResult.processed} recordings`
        };
      
      default:
        throw new Error(`Unknown Meet action: ${actionType}`);
    }
  } catch (error) {
    logger.error(`[WorkflowExecutor] Meet action failed (${actionType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute WhatsApp actions
 */
async function executeWhatsAppAction(actionType, config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for WhatsApp integration');
  }
  
  // Get credentials
  const credentials = await integrationCredentialsService.getCredentials(userId, 'whatsapp');
  if (!credentials) {
    throw new Error('WhatsApp integration not connected. Please connect WhatsApp in Settings.');
  }
  
  const whatsapp = new WhatsAppIntegration();
  await whatsapp.authenticate(credentials.credentials);
  
  // Update last used
  await integrationCredentialsService.updateLastUsed(credentials.id);
  
  try {
    if (actionType === 'whatsapp_send') {
      const sendResult = await whatsapp.sendMessage({
        to: config.to,
        message: config.message,
        mediaUrl: config.mediaUrl
      });
      return {
        success: true,
        data: sendResult,
        message: `WhatsApp message sent to ${config.to}`
      };
    } else {
      throw new Error(`Unknown WhatsApp action: ${actionType}`);
    }
  } catch (error) {
    logger.error(`[WorkflowExecutor] WhatsApp action failed (${actionType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute multi-channel collection action
 */
async function executeMultiChannelAction(config, inputData, execution) {
  const userId = execution?.user_id;
  if (!userId) {
    throw new Error('User ID required for multi-channel collection');
  }
  
  const collector = new MultiChannelCollectionService();
  
  // Get credentials for all requested channels
  const credentials = {};
  const channels = config.channels || {};
  
  if (channels.slack) {
    const slackCreds = await integrationCredentialsService.getCredentials(userId, 'slack');
    if (slackCreds) credentials.slack = slackCreds.credentials;
  }
  
  if (channels.gmail) {
    const gmailCreds = await integrationCredentialsService.getCredentials(userId, 'gmail');
    if (gmailCreds) credentials.gmail = gmailCreds.credentials;
  }
  
  if (channels.whatsapp) {
    const whatsappCreds = await integrationCredentialsService.getCredentials(userId, 'whatsapp');
    if (whatsappCreds) credentials.whatsapp = whatsappCreds.credentials;
  }
  
  if (channels.meet) {
    const meetCreds = await integrationCredentialsService.getCredentials(userId, 'google_meet');
    if (meetCreds) credentials.meet = meetCreds.credentials;
  }
  
  if (channels.sheets || config.spreadsheetId) {
    const sheetsCreds = await integrationCredentialsService.getCredentials(userId, 'google_sheets');
    if (sheetsCreds) credentials.sheets = sheetsCreds.credentials;
  }
  
  // Initialize collector
  await collector.initialize(credentials);
  
  try {
    const result = await collector.collectAndCompile({
      collectionParams: {
        since: config.since,
        keywords: config.keywords || ['feedback', 'suggestion'],
        channels: config.channels || {},
        includeTranscriptions: config.includeTranscriptions || false
      },
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName || 'Customer Feedback',
      generateSummary: config.generateSummary !== false
    });
    
    return {
      success: true,
      data: result,
      message: `Collected ${result.collection.count} feedback items from ${Object.keys(result.collection.sources).length} sources`
    };
  } catch (error) {
    logger.error('[WorkflowExecutor] Multi-channel collection failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  executeSlackAction,
  executeGmailAction,
  executeSheetsAction,
  executeMeetAction,
  executeWhatsAppAction,
  executeMultiChannelAction
};

