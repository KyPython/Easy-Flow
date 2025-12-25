/**
 * Add Integration Knowledge to RAG Service
 * Run this after implementing integrations to update AI assistant knowledge
 */

const ragClient = require('./ragClient');
const { logger } = require('../utils/logger');

const INTEGRATION_KNOWLEDGE = {
  title: 'EasyFlow Integrations - Slack, Gmail, Google Sheets, Google Meet, WhatsApp',
  category: 'integrations',
  keywords: ['slack', 'gmail', 'google sheets', 'google meet', 'whatsapp', 'integrations', 'oauth', 'connect'],
  content: `
# EasyFlow Integrations

EasyFlow supports connecting with external services to automate workflows across multiple platforms.

## Available Integrations

### Slack
- **Actions**: Send messages, read channels, collect feedback
- **OAuth**: Yes (automatic connection via OAuth)
- **Use Cases**: 
  - Send notifications to Slack channels
  - Read messages from channels
  - Collect customer feedback from Slack conversations
- **Workflow Steps**: slack_send, slack_read, slack_collect_feedback

### Gmail
- **Actions**: Send emails, read inbox, collect feedback
- **OAuth**: Yes (automatic connection via OAuth)
- **Use Cases**:
  - Send automated emails
  - Read and process incoming emails
  - Collect feedback from email responses
- **Workflow Steps**: gmail_send, gmail_read, gmail_collect_feedback

### Google Sheets
- **Actions**: Read data, write data, compile feedback
- **OAuth**: Yes (automatic connection via OAuth)
- **Use Cases**:
  - Read data from spreadsheets
  - Write data to spreadsheets
  - Compile feedback from multiple sources into a sheet
- **Workflow Steps**: sheets_read, sheets_write, sheets_compile_feedback

### Google Meet
- **Actions**: Transcribe recordings, process recordings
- **OAuth**: Yes (automatic connection via OAuth)
- **Use Cases**:
  - Transcribe meeting recordings
  - Process and extract insights from recordings
- **Workflow Steps**: meet_transcribe, meet_process_recordings

### WhatsApp
- **Actions**: Send messages
- **OAuth**: No (uses API keys)
- **Use Cases**:
  - Send messages via WhatsApp Business API
- **Workflow Steps**: whatsapp_send

## Multi-Channel Collection

EasyFlow supports collecting feedback from multiple channels simultaneously:
- **Action**: multi_channel_collect
- **Channels**: Can collect from Slack, Gmail, WhatsApp, and Google Meet
- **Output**: Compiles all feedback into a Google Sheet with AI-generated summary

## How to Use Integrations

1. **Connect Integration**: Go to Settings > Integrations and click "Connect" on any service
2. **OAuth Flow**: For OAuth-supported services, you'll be redirected to authorize EasyFlow
3. **Test Connection**: Click "Test Connection" to verify the integration works
4. **Use in Workflows**: Add integration steps to your workflows:
   - Slack: "Send a message to #general channel"
   - Gmail: "Send email to customer@example.com"
   - Sheets: "Read data from spreadsheet"
   - Multi-channel: "Collect feedback from all connected channels"

## Security

- All credentials are encrypted before storage
- OAuth tokens are stored securely
- Each user can only access their own integrations
- Credentials are never exposed in API responses

## Workflow Examples

### Example 1: Collect Feedback from Multiple Channels
1. Start step
2. Multi-channel collection step (collects from Slack, Gmail, WhatsApp)
3. Compile to Google Sheets
4. End step

### Example 2: Send Slack Notification After Task Completion
1. Start step
2. Web scrape action
3. Slack send action (notify #alerts channel)
4. End step

### Example 3: Process Gmail and Update Sheet
1. Start step
2. Gmail read action (read unread emails)
3. Data transform action (extract key info)
4. Sheets write action (update spreadsheet)
5. End step
`
};

async function addIntegrationKnowledge() {
  try {
    logger.info('[IntegrationKnowledge] Adding integration knowledge to RAG service...');
    
    const result = await ragClient.ingestText(
      INTEGRATION_KNOWLEDGE.content,
      `easyflow:${INTEGRATION_KNOWLEDGE.category}:${INTEGRATION_KNOWLEDGE.title.toLowerCase().replace(/\s+/g, '-')}`,
      {
        category: INTEGRATION_KNOWLEDGE.category,
        title: INTEGRATION_KNOWLEDGE.title,
        keywords: INTEGRATION_KNOWLEDGE.keywords
      }
    );
    
    if (result.success) {
      logger.info('[IntegrationKnowledge] Successfully added integration knowledge to RAG');
      return { success: true, message: 'Integration knowledge added to AI assistant' };
    } else {
      logger.error('[IntegrationKnowledge] Failed to add knowledge:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error('[IntegrationKnowledge] Error adding knowledge:', error);
    return { success: false, error: error.message };
  }
}

// If run directly, add the knowledge
if (require.main === module) {
  // ✅ OBSERVABILITY: Use structured logger for CLI output
  const { createLogger } = require('../middleware/structuredLogging');
  const logger = createLogger('integration.knowledge');
  
  addIntegrationKnowledge()
    .then(result => {
      if (result.success) {
        logger.info('Integration knowledge added to AI assistant', { integration: result.integration });
        process.exit(0);
      } else {
        logger.error('Failed to add knowledge', { error: result.error });
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Error adding integration knowledge', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}

module.exports = { addIntegrationKnowledge, INTEGRATION_KNOWLEDGE };

