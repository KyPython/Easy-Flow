/**
 * AI Workflow Agent Service
 *
 * Converts natural language descriptions into executable workflow configurations.
 * Uses OpenAI GPT-4 to understand user intent and generate workflow nodes/edges.
 *
 * POWERED BY RAG-NODE-TS:
 * - Uses your rag-node-ts RAG service for knowledge retrieval
 * - All app knowledge is stored in Pinecone via your RAG SaaS
 * - Continuous learning through the RAG service
 *
 * OBSERVABILITY:
 * - All logs flow through structured logging with trace context
 * - Token usage metrics tracked for cost monitoring
 * - Performance metrics for AI response times
 * - Business metrics for usage analytics
 */

const OpenAI = require('openai');
const { createLogger } = require('../middleware/structuredLogging');
const ragClient = require('./ragClient');

// Namespaced logger for AI Workflow Agent
const logger = createLogger('ai.agent');

// Lazy-initialize OpenAI client (only when first needed, not at module load)
let _openaiClient = null;
function getOpenAI() {
 if (!_openaiClient) {
 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) {
 logger.warn('OpenAI API key not configured - AI features will be limited');
 return null;
 }
 _openaiClient = new OpenAI({ apiKey });
 }
 return _openaiClient;
}

// Workflow step definitions for the AI to understand
const WORKFLOW_STEPS = {
 start: {
 id: 'start',
 label: 'Start',
 description: 'Entry point of the workflow',
 icon: '🎬',
 configSchema: {}
 },
 web_scrape: {
 id: 'web_scrape',
 label: 'Web Scraping',
 description: 'Extract data from websites using CSS selectors',
 icon: '🌐',
 configSchema: {
 url: { type: 'string', description: 'URL to scrape' },
 selectors: { type: 'array', description: 'CSS selectors to extract data' },
 timeout: { type: 'number', default: 30 }
 }
 },
 api_call: {
 id: 'api_call',
 label: 'API Request',
 description: 'Make HTTP requests to external APIs',
 icon: '🔗',
 configSchema: {
 method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
 url: { type: 'string', description: 'API endpoint URL' },
 headers: { type: 'object', description: 'Request headers' },
 body: { type: 'object', description: 'Request body for POST/PUT' }
 }
 },
 data_transform: {
 id: 'data_transform',
 label: 'Transform Data',
 description: 'Process and transform data between steps',
 icon: '🔄',
 configSchema: {
 transformations: { type: 'array', description: 'List of transformations to apply' },
 output_format: { type: 'string', enum: ['json', 'csv', 'text'], default: 'json' }
 }
 },
 condition: {
 id: 'condition',
 label: 'Condition',
 description: 'Branch workflow based on conditions',
 icon: '❓',
 configSchema: {
 conditions: { type: 'array', description: 'Conditions to evaluate' },
 operator: { type: 'string', enum: ['AND', 'OR'], default: 'AND' }
 }
 },
 email: {
 id: 'email',
 label: 'Send Email',
 description: 'Send email notifications',
 icon: '📧',
 configSchema: {
 to: { type: 'array', description: 'Recipient email addresses' },
 subject: { type: 'string', description: 'Email subject line' },
 template: { type: 'string', description: 'Email body content' }
 }
 },
 file_upload: {
 id: 'file_upload',
 label: 'Upload File',
 description: 'Store files to cloud storage',
 icon: '📁',
 configSchema: {
 destination: { type: 'string', description: 'Storage destination path' },
 filename: { type: 'string', description: 'Name for the uploaded file' }
 }
 },
 delay: {
 id: 'delay',
 label: 'Delay',
 description: 'Wait for a specified duration',
 icon: '⏰',
 configSchema: {
 duration_seconds: { type: 'number', description: 'Wait time in seconds' }
 }
 },
 end: {
 id: 'end',
 label: 'End',
 description: 'Completion point of the workflow',
 icon: '🏁',
 configSchema: {
 success: { type: 'boolean', default: true },
 message: { type: 'string', description: 'Completion message' }
 }
 },
 slack_send: {
 id: 'slack_send',
 label: 'Send Slack Message',
 description: 'Send a message to a Slack channel',
 icon: '💬',
 configSchema: {
 channel: { type: 'string', description: 'Slack channel name (e.g., #general)' },
 message: { type: 'string', description: 'Message text to send' }
 }
 },
 slack_read: {
 id: 'slack_read',
 label: 'Read Slack Messages',
 description: 'Read messages from a Slack channel',
 icon: '📥',
 configSchema: {
 channel: { type: 'string', description: 'Slack channel name' },
 limit: { type: 'number', default: 100, description: 'Maximum number of messages to read' }
 }
 },
 slack_collect_feedback: {
 id: 'slack_collect_feedback',
 label: 'Collect Feedback from Slack',
 description: 'Collect customer feedback from Slack messages',
 icon: '💭',
 configSchema: {
 channel: { type: 'string', description: 'Slack channel to monitor' },
 keywords: { type: 'array', description: 'Keywords to filter feedback (e.g., ["feedback", "suggestion"])' }
 }
 },
 gmail_send: {
 id: 'gmail_send',
 label: 'Send Gmail',
 description: 'Send an email via Gmail',
 icon: '📧',
 configSchema: {
 to: { type: 'array', description: 'Recipient email addresses' },
 subject: { type: 'string', description: 'Email subject' },
 body: { type: 'string', description: 'Email body text' }
 }
 },
 gmail_read: {
 id: 'gmail_read',
 label: 'Read Gmail',
 description: 'Read emails from Gmail inbox',
 icon: '📬',
 configSchema: {
 query: { type: 'string', description: 'Gmail search query (e.g., "from:customer@example.com")' },
 maxResults: { type: 'number', default: 10, description: 'Maximum emails to read' }
 }
 },
 gmail_collect_feedback: {
 id: 'gmail_collect_feedback',
 label: 'Collect Feedback from Gmail',
 description: 'Collect customer feedback from emails',
 icon: '💌',
 configSchema: {
 keywords: { type: 'array', description: 'Keywords to filter feedback' },
 maxResults: { type: 'number', default: 50 }
 }
 },
 sheets_read: {
 id: 'sheets_read',
 label: 'Read Google Sheet',
 description: 'Read data from a Google Sheet',
 icon: '📊',
 configSchema: {
 spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
 range: { type: 'string', description: 'Cell range (e.g., "A1:C10")' },
 sheetName: { type: 'string', description: 'Sheet name (optional)' }
 }
 },
 sheets_write: {
 id: 'sheets_write',
 label: 'Write to Google Sheet',
 description: 'Write data to a Google Sheet',
 icon: '✍️',
 configSchema: {
 spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
 range: { type: 'string', description: 'Cell range to write to' },
 values: { type: 'array', description: 'Data to write (array of arrays)' },
 sheetName: { type: 'string', description: 'Sheet name (optional)' }
 }
 },
 sheets_compile_feedback: {
 id: 'sheets_compile_feedback',
 label: 'Compile Feedback to Sheet',
 description: 'Compile feedback from multiple sources into a Google Sheet',
 icon: '📋',
 configSchema: {
 spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
 feedback: { type: 'array', description: 'Array of feedback items to compile' },
 sheetName: { type: 'string', default: 'Feedback', description: 'Sheet name' }
 }
 },
 meet_transcribe: {
 id: 'meet_transcribe',
 label: 'Transcribe Meet Recording',
 description: 'Download and transcribe a Google Meet recording',
 icon: '🎙️',
 configSchema: {
 fileId: { type: 'string', description: 'Google Drive file ID of the Meet recording' }
 }
 },
 meet_process_recordings: {
 id: 'meet_process_recordings',
 label: 'Process Meet Recordings',
 description: 'Find and transcribe all recent Meet recordings',
 icon: '🎥',
 configSchema: {
 since: { type: 'string', description: 'ISO date string - only process recordings after this date' },
 extractInsights: { type: 'boolean', default: false, description: 'Extract insights from transcriptions' }
 }
 },
 whatsapp_send: {
 id: 'whatsapp_send',
 label: 'Send WhatsApp Message',
 description: 'Send a message via WhatsApp',
 icon: '📱',
 configSchema: {
 to: { type: 'string', description: 'WhatsApp phone number (with country code)' },
 message: { type: 'string', description: 'Message text to send' }
 }
 },
 multi_channel_collect: {
 id: 'multi_channel_collect',
 label: 'Collect from All Channels',
 description: 'Collect feedback from Slack, Gmail, WhatsApp, and Meet automatically',
 icon: '🔄',
 configSchema: {
 since: { type: 'string', description: 'ISO date string - only collect feedback after this date' },
 keywords: { type: 'array', description: 'Keywords to filter feedback' },
 channels: { type: 'object', description: 'Channel configuration (slack, gmail, whatsapp, meet)' },
 includeTranscriptions: { type: 'boolean', default: false, description: 'Include Meet transcriptions' }
 }
 },
 reddit_monitor: {
 id: 'reddit_monitor',
 label: 'Monitor Reddit',
 description: 'Search Reddit for posts matching keywords and extract threads',
 icon: '📱',
 configSchema: {
 keywords: { type: 'array', description: 'Keywords to search for (e.g., ["product name", "competitor"])' },
 subreddits: { type: 'array', description: 'Subreddits to search (leave empty to search all of Reddit)' },
 limit: { type: 'number', default: 25, description: 'Maximum posts to retrieve per keyword' },
 includeComments: { type: 'boolean', default: false, description: 'Include comment threads' }
 }
 },
 reddit_analyze: {
 id: 'reddit_analyze',
 label: 'Analyze Reddit Content',
 description: 'Analyze sentiment, classify topics, and extract insights from Reddit posts/comments',
 icon: '🔍',
 configSchema: {
 content: { type: 'object', description: 'Reddit post or comment data to analyze' },
 businessContext: { type: 'object', description: 'Business context for better analysis' }
 }
 },
 reddit_generate_insights: {
 id: 'reddit_generate_insights',
 label: 'Generate Team Insights',
 description: 'Generate insights for product, marketing, sales, and support teams',
 icon: '💡',
 configSchema: {
 analyses: { type: 'array', description: 'Array of analyzed Reddit content' },
 teams: { type: 'array', description: 'Teams to generate insights for (product, marketing, sales, support)' }
 }
 },
 reddit_generate_blog_topics: {
 id: 'reddit_generate_blog_topics',
 label: 'Generate Blog Topics',
 description: 'Generate blog post topic suggestions from Reddit discussions',
 icon: '✍️',
 configSchema: {
 insights: { type: 'object', description: 'Insights from Reddit analysis' },
 count: { type: 'number', default: 5, description: 'Number of blog topics to generate' }
 }
 }
};

// System prompt for the AI agent
const SYSTEM_PROMPT = `You are an AI assistant that helps users create automation workflows using natural language.

You convert user descriptions into structured workflow configurations with the following step types:
${Object.values(WORKFLOW_STEPS).map(s => `- ${s.id}: ${s.description} ${s.icon}`).join('\n')}

IMPORTANT RULES:
1. Always start workflows with a "start" step
2. Always end workflows with an "end" step
3. Connect steps logically based on the user's intent
4. Position nodes visually (start at x:100, increment x by 250 for each subsequent step)
5. Use clear, descriptive labels for each step
6. Configure steps with realistic default values when not specified

When generating workflows, respond with a JSON object in this exact format:
{
 "workflow": {
 "name": "Descriptive workflow name",
 "description": "What this workflow does",
 "nodes": [
 {
 "id": "unique-node-id",
 "stepType": "step_type_from_list",
 "label": "Human readable label",
 "position": { "x": number, "y": number },
 "config": { /* step-specific configuration */ }
 }
 ],
 "edges": [
 {
 "id": "edge-id",
 "source": "source-node-id",
 "target": "target-node-id"
 }
 ]
 },
 "explanation": "Brief explanation of what this workflow does and how to customize it",
 "suggestions": ["Suggestion 1 for improvement", "Suggestion 2"]
}

Be helpful, creative, and ensure workflows are practical and executable.`;

/**
 * Parse natural language into a workflow configuration
 * Uses rag-node-ts RAG service for knowledge retrieval
 *
 * OBSERVABILITY: Performance tracking for workflow generation
 */
async function parseNaturalLanguage(userMessage, context = {}) {
 const startTime = Date.now();
 const parseLogger = logger.withOperation('ai.agent.parseNaturalLanguage', {
 userId: context.userId
 });

 try {
 // 🧠 RAG: Get relevant knowledge from your rag-node-ts service
 let knowledgeContext = { context: '', sources: [], method: 'none' };

 try {
 const ragStartTime = Date.now();
 const ragResult = await ragClient.query(userMessage, {
 topK: 5,
 mode: 'retrieval', // Just get passages, we'll generate our own answer
 useCache: true
 });

 if (ragResult.success && ragResult.results?.length > 0) {
 knowledgeContext = {
 context: ragResult.results.map(r => r.text).join('\n\n'),
 sources: ragResult.results.map(r => r.metadata?.source || 'rag'),
 method: 'rag-node-ts'
 };

 parseLogger.info('Retrieved knowledge from rag-node-ts', {
 sources: knowledgeContext.sources?.slice(0, 3),
 contextLength: knowledgeContext.context?.length || 0,
 ragDuration: Date.now() - ragStartTime
 });
 }
 } catch (ragError) {
 parseLogger.warn('RAG service (rag-node-ts) unavailable', {
 error: ragError.message,
 ragUrl: ragClient.RAG_SERVICE_URL,
 hint: 'Start rag-node-ts service'
 });
 }

 // Build enhanced system prompt with app-specific knowledge
 const enhancedSystemPrompt = `${SYSTEM_PROMPT}

## EASY-FLOW APP KNOWLEDGE
The following is specific knowledge about the Easy-Flow app that you should use to provide accurate responses:

${knowledgeContext.context}

Use this knowledge to provide accurate, helpful responses about the Easy-Flow app features and capabilities.`;

 const messages = [
 { role: 'system', content: enhancedSystemPrompt }
 ];

 // Add conversation context if provided
 if (context.previousMessages && context.previousMessages.length > 0) {
 messages.push(...context.previousMessages.slice(-6)); // Keep last 6 messages for context
 }

 messages.push({ role: 'user', content: userMessage });

 const completion = await getOpenAI().chat.completions.create({
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 messages,
 temperature: 0.7,
 max_tokens: 2000,
 response_format: { type: 'json_object' }
 });

 const responseContent = completion.choices[0].message.content;
 const parsedResponse = JSON.parse(responseContent);

 // Validate and enhance the response
 const enhancedWorkflow = enhanceWorkflow(parsedResponse.workflow);

 return {
 success: true,
 workflow: enhancedWorkflow,
 explanation: parsedResponse.explanation,
 suggestions: parsedResponse.suggestions || [],
 usage: completion.usage,
 knowledgeSources: knowledgeContext.sources // Track what knowledge was used
 };

 } catch (error) {
 logger.error('[AI Agent] Error parsing natural language:', error);

 // Return a helpful error response
 return {
 success: false,
 error: error.message,
 suggestion: 'Try describing your workflow more specifically. For example: "Scrape prices from amazon.com every day and email me a report"'
 };
 }
}

/**
 * Enhance and validate the generated workflow
 */
function enhanceWorkflow(workflow) {
 if (!workflow || !workflow.nodes) {
 return null;
 }

 const timestamp = Date.now();

 // Ensure all nodes have proper IDs and positions
 const enhancedNodes = workflow.nodes.map((node, index) => ({
 id: node.id || `node-${node.stepType}-${timestamp}-${index}`,
 type: 'customStep',
 position: node.position || { x: 100 + (index * 250), y: 150 },
 data: {
 label: node.label || WORKFLOW_STEPS[node.stepType]?.label || 'Step',
 stepType: node.stepType,
 actionType: getActionType(node.stepType),
 config: node.config || {},
 isConfigured: Object.keys(node.config || {}).length > 0
 }
 }));

 // Ensure edges have proper IDs
 const enhancedEdges = (workflow.edges || []).map((edge, index) => ({
 id: edge.id || `edge-${timestamp}-${index}`,
 source: edge.source,
 target: edge.target,
 animated: true,
 style: {
 stroke: 'var(--color-primary-600)',
 strokeWidth: 2
 }
 }));

 return {
 name: workflow.name || 'AI Generated Workflow',
 description: workflow.description || 'Workflow created by AI assistant',
 nodes: enhancedNodes,
 edges: enhancedEdges,
 canvas_config: {
 nodes: enhancedNodes,
 edges: enhancedEdges,
 viewport: { x: 0, y: 0, zoom: 1 }
 }
 };
}

/**
 * Get action type for a step
 */
function getActionType(stepType) {
 const nonActionTypes = ['start', 'end', 'condition'];
 return nonActionTypes.includes(stepType) ? null : stepType;
}

/**
 * Get smart suggestions based on partial input
 */
async function getSuggestions(partialInput) {
 const commonPatterns = [
 {
 trigger: ['scrape', 'extract', 'get data from'],
 suggestions: [
 'Scrape product prices from a website and save to spreadsheet',
 'Extract news headlines and send daily email digest',
 'Monitor competitor prices and alert when they change'
 ]
 },
 {
 trigger: ['email', 'send', 'notify'],
 suggestions: [
 'Send automated email reports every morning',
 'Email me when a website changes',
 'Send notifications when tasks complete'
 ]
 },
 {
 trigger: ['api', 'webhook', 'integrate'],
 suggestions: [
 'Sync data between two APIs automatically',
 'Post data to Slack when something happens',
 'Integrate with CRM and update records'
 ]
 },
 {
 trigger: ['schedule', 'daily', 'weekly', 'every'],
 suggestions: [
 'Run web scraping daily at 9 AM',
 'Weekly backup and email report',
 'Check inventory every hour'
 ]
 },
 {
 trigger: ['condition', 'if', 'when', 'check'],
 suggestions: [
 'If price drops below $50, send alert',
 'When stock is low, reorder automatically',
 'Check if website is down and notify team'
 ]
 }
 ];

 const inputLower = partialInput.toLowerCase();

 // Find matching patterns
 for (const pattern of commonPatterns) {
 if (pattern.trigger.some(t => inputLower.includes(t))) {
 return pattern.suggestions;
 }
 }

 // Default suggestions
 return [
 'Scrape data from a website and save it',
 'Send automated email notifications',
 'Connect two apps with an API workflow',
 'Monitor a website for changes',
 'Transform and process data automatically'
 ];
}

/**
 * Get conversation response for non-workflow queries
 * Uses rag-node-ts RAG service for knowledge-powered responses
 */
async function getConversationResponse(userMessage, context = {}) {
 try {
 // 🧠 RAG: Get answer from your rag-node-ts service
 let knowledgeContext = { context: '', sources: [], method: 'none' };
 let ragAnswer = null;

 try {
 const ragResult = await ragClient.query(userMessage, {
 topK: 5,
 mode: 'answer', // Get full RAG answer with citations
 useCache: true
 });

 if (ragResult.success) {
 // If RAG gives a good answer, we can use it or enhance it
 if (ragResult.answer && !ragResult.answer.includes('does not contain enough information')) {
 ragAnswer = ragResult.answer;
 }

 // Also extract context for our own answer generation
 if (ragResult.citations?.length > 0) {
 knowledgeContext = {
 context: ragResult.citations.map(c => c.text).join('\n\n'),
 sources: ragResult.citations.map(c => c.metadata?.source || 'rag'),
 method: 'rag-node-ts'
 };
 }

 logger.info('[AI Agent] Retrieved knowledge from rag-node-ts', {
 sources: knowledgeContext.sources?.slice(0, 3),
 hasAnswer: !!ragAnswer
 });
 }
 } catch (ragError) {
 logger.warn('[AI Agent] RAG service (rag-node-ts) unavailable', {
 error: ragError.message,
 hint: 'Make sure rag-node-ts is running at ' + ragClient.RAG_SERVICE_URL
 });
 }

 // Get support email from config
 const { config: appConfig } = require('../utils/appConfig');
 const supportEmail = appConfig.urls.supportEmail;

 const enhancedSystemPrompt = `You are a helpful AI assistant for an automation workflow builder called Easy-Flow. 

## YOUR KNOWLEDGE ABOUT EASY-FLOW
${knowledgeContext.context}

## YOUR CAPABILITIES
Help users understand:
- How to create workflows (drag & drop steps, connect them, configure each step)
- Available step types: ${Object.values(WORKFLOW_STEPS).map(s => `${s.icon} ${s.label}`).join(', ')}
- Troubleshooting common issues
- Best practices for automation

## NEW FEATURES (Updated 2025):
- 📌 Bookmarklet for Vendor Portals: One-click invoice download setup from vendor portals. When users mention "vendor portal" or "invoice download", IMMEDIATELY provide the bookmarklet solution. DO NOT ask for the URL - the bookmarklet eliminates that need! The frontend automatically shows the bookmarklet button when these keywords are detected. Your response should focus on: "Perfect! Here's the easiest way - drag the bookmarklet button to your bookmarks bar, then when you're on your vendor portal, just click it! EasyFlow will open with the URL already filled in - just add your login credentials and click Run Automation. No more switching tabs or copying URLs!" After providing this, you can offer alternatives like "Or if you prefer, just tell me the vendor portal URL and I can help you set it up" but the bookmarklet should be the PRIMARY solution.
- ✨ Auto-Scroll & Smart Navigation: The app automatically scrolls to relevant content and redirects after actions. Much easier to use!
- 🎯 Plain English UI: All technical jargon replaced with plain English. Match this friendly, non-technical style in your responses!
- 🤖 AI Extraction: FREE AI-powered data extraction from PDFs and web pages. Users can enable this when creating tasks.
- 🔍 Improved Link Discovery: "Find Available Buttons" feature shows all clickable links - users can click one to auto-fill instead of typing.
- ⚡ Better Error Handling: Errors auto-scroll to problem fields and use plain English messages focused on what to do next.

## TASK CONFIGURATION - COMPREHENSIVE GUIDE:
EasyFlow supports three task types: invoice_download, web_scraping, and form_submission. When users want to create a task, guide them through configuration:

INVOICE DOWNLOAD: Required - Target URL. Optional - Username/Password if login needed. Discovery Method - "Auto-detect" (recommended) or "Find by Link Text". Link Text - if using text-match, specify button text (users can click "Find Available Buttons" to see options). AI Extraction - Optional, FREE, extracts data from PDFs.

WEB SCRAPING: Required - Target URL. Optional - Username/Password if login needed. What parts to grab - selectors like ".price", "#product-title", "h1" (UI shows "What parts of the page should we grab?"). AI Extraction - Optional, FREE, extracts data from HTML. Format: "field_name: description" (one per line).

FORM SUBMISSION: Required - Target URL (webpage containing the form). Optional - Username/Password if login needed before accessing form. Form Data - the automation worker finds and fills form fields automatically. Form data provided as key-value pairs where keys match form field names and values are what to enter. Worker uses Puppeteer to navigate, find form elements, fill them, and submit.

AI EXTRACTION: Available for ALL task types, FREE. Enable checkbox, specify targets as "field_name: description" (one per line). Textarea auto-formats. After completion, AI processes artifact and extracts fields. Results in automation_runs with confidence scores.

LINK DISCOVERY: Click "Find Available Buttons" to see all clickable links. Each shown as clickable button. Clicking auto-fills "Link Text" field. Always uses auto-detect to show ALL links.

TASK SUBMISSION: User configures -> Clicks "Run Automation" -> App validates -> Submits -> Creates records -> Queues to worker -> Shows success -> Auto-redirects to history after 2 seconds -> Task appears with status: queued -> running -> completed/failed.

HOW TO HELP: 1) Identify task type, 2) Get URL (suggest bookmarklet for vendor portals), 3) Check if login needed, 4) For invoices: recommend auto-detect, suggest "Find Available Buttons" if fails, 5) For scraping: ask what data, suggest selectors, 6) Suggest AI extraction if they want structured data, 7) Explain format: "field_name: description", 8) Confirm details, 9) ALWAYS use plain English, avoid jargon.

## SUPPORT CAPABILITIES
You can also help users with support:
- If they need to contact support, provide: ${supportEmail}
- If they want to send an email, you can help them compose it
- For billing questions, direct them to the Settings > Billing page

If the user wants to CREATE a workflow, tell them to describe it and you'll generate it automatically.
Keep responses concise, friendly, and helpful. Use emojis occasionally.
ALWAYS base your answers on the Easy-Flow knowledge provided above when relevant.`;

 const messages = [
 { role: 'system', content: enhancedSystemPrompt }
 ];

 if (context.previousMessages) {
 messages.push(...context.previousMessages.slice(-4));
 }

 messages.push({ role: 'user', content: userMessage });

 const completion = await getOpenAI().chat.completions.create({
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 messages,
 temperature: 0.8,
 max_tokens: 500
 });

 return {
 success: true,
 message: completion.choices[0].message.content,
 isWorkflowRequest: false,
 knowledgeSources: knowledgeContext.sources
 };

 } catch (error) {
 logger.error('[AI Agent] Error in conversation:', error);
 return {
 success: false,
 message: "I'm having trouble connecting right now. Please try again!",
 error: error.message
 };
 }
}

/**
 * Determine if user input is a workflow request or general question
 */
function isWorkflowRequest(userMessage) {
 const workflowKeywords = [
 'create workflow', 'build workflow', 'make workflow', 'generate workflow',
 'new workflow', 'design workflow', 'setup workflow'
 ];

 const inputLower = userMessage.toLowerCase();
 return workflowKeywords.some(keyword => inputLower.includes(keyword));
}

/**
 * Main handler for AI agent interactions
 *
 * NOW WITH FULL APP CONTROL:
 * - Uses OpenAI function calling to decide when to execute actions
 * - Can create tasks, run workflows, scrape websites, send emails, etc.
 * - All via natural language!
 *
 * OBSERVABILITY: Full structured logging with performance & token tracking
 */
async function handleMessage(userMessage, context = {}) {
 const startTime = Date.now();
 const actionExecutor = require('./aiActionExecutor');

 // Create user-scoped logger for this interaction
 const msgLogger = logger
 .withUser({ id: context.userId, email: context.userEmail })
 .withOperation('ai.agent.handleMessage', {
 messageLength: userMessage?.length || 0
 });

 // Check if OpenAI is configured
 const openai = getOpenAI();
 if (!openai) {
 msgLogger.warn('OpenAI not configured, returning fallback response');
 return {
 type: 'conversation',
 success: true,
 message: "I'm sorry, but the AI features are currently not available. Please contact support or try again later. You can still create workflows manually using the drag-and-drop interface!",
 aiEnabled: false
 };
 }

 try {
 msgLogger.info('Processing AI message', {
 messagePreview: userMessage?.slice(0, 50),
 hasContext: !!context.previousMessages
 });

 // Get available actions as OpenAI tools
 const tools = actionExecutor.getActionsAsTools();

 // Also add workflow generation as a tool
 tools.push({
 type: 'function',
 function: {
 name: 'generate_workflow',
 description: 'Generate a complete workflow configuration from natural language description. Use this when user wants to create a new multi-step workflow.',
 parameters: {
 type: 'object',
 properties: {
 description: { type: 'string', description: 'Natural language description of the workflow to create' }
 },
 required: ['description']
 }
 }
 });

 // Build system prompt with capabilities
 const systemPrompt = `You are a friendly AI assistant for Easy-Flow, an automation platform. You help everyday people automate tasks without needing technical knowledge.

WHAT YOU CAN DO:
1. Quick Actions: Scrape websites, send emails, make API calls, check account status, show tasks
2. Build Workflows: Create multi-step automations
3. Manage: List tasks/workflows (use list_tasks when user asks to "show my tasks"), check history, schedule things
4. Help: Answer questions, troubleshoot, contact support

NEW FEATURES YOU SHOULD KNOW ABOUT:
- 📌 Bookmarklet for Vendor Portals: Users can download invoices from vendor portals with one click! When users mention "vendor portal" or "invoice download", IMMEDIATELY provide the bookmarklet solution. DO NOT ask for the URL - the bookmarklet handles that! Tell them: "Perfect! Here's the easiest way - drag the bookmarklet button to your bookmarks bar, then when you're on your vendor portal, just click it! EasyFlow will open with the URL already filled in - just add your login credentials and click Run Automation. No more switching tabs or copying URLs!" The frontend will show the bookmarklet button automatically, so you don't need to ask for URLs.
- ✨ Auto-Scroll & Smart Navigation: The app now automatically scrolls to relevant content (errors, results, forms) and redirects users after actions complete. This makes the app much easier to use!
- 🎯 Plain English UI: All technical jargon has been replaced with plain English. For example, "CSS Selectors" is now "What parts of the page should we grab?" - make sure your responses match this friendly, non-technical style!
- 🤖 AI Extraction: Users can enable AI-powered data extraction when creating tasks. The AI automatically extracts structured data from PDFs and web pages after tasks complete. This is FREE for everyone!
- 🔍 Improved Link Discovery: When downloading invoices, users can click "Find Available Buttons" to see all clickable links on a page, then click one to auto-fill. Much easier than typing!
- ⚡ Better Error Handling: Errors now automatically scroll to the problem field and use plain English messages. The app focuses on what to do next, not technical details.

TASK CONFIGURATION - YOU MUST KNOW THIS:
EasyFlow supports three task types: invoice_download, web_scraping, and form_submission. When users want to create a task, guide them through configuration:

INVOICE DOWNLOAD TASKS:
- Required: Target URL (vendor portal URL)
- Optional: Username/Email and Password (if login required)
- Discovery Method: "Auto-detect" (recommended, works 99% of the time) or "Find by Link Text"
- Link Text: If using text-match, specify exact button text (users can click "Find Available Buttons" to see all options)
- AI Extraction: Optional, FREE - enables automatic data extraction from downloaded PDFs
- After submission: Task runs automatically, results appear in Automation History, app auto-redirects after 2 seconds

WEB SCRAPING TASKS:
- Required: Target URL (webpage to scrape)
- Optional: Username/Email and Password (if login required)
- What parts to grab: CSS selectors like ".price", "#product-title", "h1", "h2" (UI shows "What parts of the page should we grab?")
- AI Extraction: Optional, FREE - enables automatic data extraction from scraped HTML
- Extraction Targets Format: "field_name: description" (one per line), e.g., "product_name: Name of the product", "price: Product price"

FORM SUBMISSION TASKS:
- Required: Target URL (the webpage URL containing the form to submit)
- Optional: Username/Email and Password (if the site requires login before accessing the form)
- Form Data: The automation worker will find and fill form fields on the page. Form data is typically provided as key-value pairs where keys match form field names (name, id, or label) and values are what to enter. The worker uses Puppeteer to navigate, find form elements, fill them, and submit.
- The task type is "form_submission" and is selected in the Task Type dropdown

AI EXTRACTION CONFIGURATION:
- Available for ALL task types, FREE for everyone
- Enable checkbox "Enable AI-Powered Web Scraping"
- In "What data should we extract?" textarea, specify targets as "field_name: description" (one per line)
- The textarea auto-formats as users type (adds ": " when pressing Enter)
- After task completion, AI processes artifact (PDF or HTML) and extracts specified fields
- Results stored in automation_runs with confidence scores
- Uses the same AI model as the chatbot

LINK DISCOVERY FOR INVOICE DOWNLOADS:
- Users can click "Find Available Buttons" to see all clickable links on a page
- Each discovered link shown as clickable button with text, URL, and confidence score
- Clicking a button auto-fills the "Link Text" field
- Discovery test always uses auto-detect mode to show ALL available links
- Eliminates need for tab switching and manual inspection

TASK SUBMISSION FLOW:
1. User configures task (URL, credentials, discovery method, AI extraction if desired)
2. Clicks "Run Automation"
3. App validates fields, shows errors with auto-scroll to first error if any
4. Submits to /api/automation/execute (or /api/run-task-with-ai if AI enabled)
5. Creates records in automation_tasks and automation_runs tables
6. Queues task to automation worker via Kafka
7. Shows success message with task ID
8. Auto-redirects to /app/history after 2 seconds
9. Task appears in Automation History with status: "queued" -> "running" -> "completed" or "failed"
10. Users can view results, download artifacts (PDFs), see AI-extracted data if enabled

HOW TO HELP USERS CONFIGURE TASKS:
1. Identify task type (invoice download, web scraping, or form submission)
2. Get target URL (or suggest bookmarklet for vendor portals)
3. Determine if login required (ask for credentials if needed)
4. For invoice downloads: Recommend auto-detect first, if fails suggest "Find Available Buttons"
5. For web scraping: Ask what data they want, suggest selectors (e.g., ".price" for prices, "h1" for titles)
6. For form submission: Ask what form fields need to be filled (e.g., name, email, message) and their values. Explain that the automation will find the form on the page and fill it automatically.
7. Suggest enabling AI extraction if they want structured data
8. Explain extraction targets format: "field_name: description" (one per line)
9. Confirm all details before submission
10. ALWAYS use plain English, avoid technical jargon like "CSS selectors", "API", "DOM", "JSON", "HTTP"

WORKFLOW CONFIGURATION - YOU MUST KNOW THIS:
EasyFlow workflows are multi-step automations created in the Workflow Builder (/app/workflows). Available steps:
- Start: Entry point (required, no config)
- Web Scraping: Extract data (config: URL, CSS selectors, timeout) - UI shows "What parts of the page should we grab?"
- API Request: Make HTTP calls (config: method GET/POST/PUT/DELETE, URL, headers, body) - UI shows "What should we do?" and "What data should we send?"
- Transform Data: Process data (config: transformations, output format)
- Condition: Branch workflow (config: conditions, AND/OR operator)
- Send Email: Email notifications (config: to addresses, subject, template with {{variables}})
- Upload File: Save files (config: destination, source field, filename)
- Delay: Pause execution (config: duration in seconds)
- End: Mark completion (config: success status, message)

WORKFLOW BUILDER USAGE:
- Drag steps from Actions toolbar onto canvas
- Connect steps by dragging from output handles to input handles
- Click any step to configure in side panel
- Workflows auto-save as you work
- Can run immediately or schedule for recurring execution
- Variables from previous steps: use {{stepName.field}} syntax

APP NAVIGATION - YOU MUST KNOW THIS:
- Dashboard (/app): EasyFlow app status (runs, workflows, schedules, metrics)
- Status (/app/unified-dashboard): External tools/integrations status
- Task Management (/app/tasks): Create one-time tasks
- Automation History (/app/history): View all task runs and results
- Workflows (/app/workflows): Create and manage multi-step workflows
- Files (/app/files): Manage uploaded/downloaded files
- Integrations (/app/integrations): Connect external tools
- Settings (/app/settings): Account and preferences

APP FEATURES - YOU MUST KNOW THIS:
- AI Assistant: Available globally via toggle button. Can create tasks, build workflows, answer questions
- Bookmarklet: One-click invoice download setup from vendor portals
- AI Extraction: FREE automatic data extraction from PDFs and web pages
- Link Discovery: "Find Available Buttons" shows all clickable links for easy selection
- Auto-Scroll: App automatically scrolls to errors, results, and relevant content
- Smart Redirects: Auto-redirects after task submission (2s) and from result modals (5s)
- Plain English UI: All technical jargon replaced with user-friendly labels

IMPORTANT - WHEN TO USE list_tasks:
- User says: "show my tasks", "list tasks", "what tasks do I have", "view my tasks", "all my tasks"
- ALWAYS use list_tasks function for these requests - don't just respond conversationally

COMMUNICATION STYLE - THIS IS CRITICAL:
- ALWAYS respond in simple, plain English that anyone can understand
- NEVER use technical jargon like: JavaScript, CSS selectors, API, DOM, rendering, parsing, JSON, HTTP, endpoints, etc.
- If something technical happens, explain it simply: "The website blocked our request" NOT "JavaScript rendering prevented extraction"
- Focus on WHAT happened and WHAT TO DO NEXT, not WHY technically
- Be warm, helpful, and encouraging - like talking to a friend
- Use everyday analogies when explaining things
- If something didn't work, suggest simple alternatives the user can try
- Keep responses SHORT and actionable

EXAMPLES OF GOOD VS BAD RESPONSES:
❌ BAD: "The page uses JavaScript rendering so dynamic content wasn't loaded. Try specifying CSS selectors."
✅ GOOD: "I checked the website but couldn't find the prices - they might be hidden. Try giving me a direct link to a specific product page!"

❌ BAD: "The API returned a 403 error due to authentication failure."
✅ GOOD: "The website blocked my access. This sometimes happens with certain sites. Want to try a different website?"

BE HELPFUL:
- If scraping a homepage doesn't find what user wants, suggest they try a more specific page URL
- Don't just say "I couldn't find it" - offer to try a different approach
- Keep responses short and actionable

SCRAPING TIPS:
- For Hacker News (news.ycombinator.com): When user asks for "headlines" or "stories", automatically use selectors: [".titleline > a"]
- For Reddit: When user asks for "posts" or "titles", use selectors: ["h3", ".title"]
- For news sites: When user asks for "headlines", try selectors: ["h1", "h2", ".headline"]
- Always use appropriate selectors based on what the user is asking for

RULES:
- For simple ONE-TIME actions (scrape a site now, send one email), do them directly
- For RECURRING automations ("monitor daily", "check every hour", "weekly report"), use create_automated_workflow - this will create AND schedule it automatically
- For questions about the app, respond conversationally
- Always confirm before sending emails or making changes
- Be friendly and use emojis occasionally 😊

WHEN TO USE create_automated_workflow:
- User says "daily", "weekly", "hourly", "monthly", "every", "monitor", "recurring", "automate"
- Examples: "Monitor example.com daily", "Send me weekly sales reports", "Check prices every hour"
- This creates the workflow AND schedules it in one step - no extra clicks needed!
- NOTE: If the user's plan doesn't support scheduled automations, the workflow will be created but not scheduled. Inform them they can upgrade to enable scheduling.

Available automation types: ${Object.values(WORKFLOW_STEPS).map(s => `${s.icon} ${s.label}`).join(', ')}`;

 const messages = [
 { role: 'system', content: systemPrompt }
 ];

 // Add conversation history
 if (context.previousMessages && context.previousMessages.length > 0) {
 messages.push(...context.previousMessages.slice(-6));
 }

 messages.push({ role: 'user', content: userMessage });

 // Call OpenAI with function calling
 const llmStartTime = Date.now();
 const completion = await getOpenAI().chat.completions.create({
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 messages,
 tools,
 tool_choice: 'auto', // Let the AI decide when to use tools
 temperature: 0.7,
 max_tokens: 2000
 });
 const llmDuration = Date.now() - llmStartTime;

 // Track OpenAI API performance
 msgLogger.performance('ai.openai.completion', llmDuration, {
 category: 'ai_llm',
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 tokenUsage: completion.usage
 });

 // Track token usage for cost monitoring
 if (completion.usage) {
 msgLogger.metric('ai.openai.tokens.prompt', completion.usage.prompt_tokens, 'tokens', {
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
 });
 msgLogger.metric('ai.openai.tokens.completion', completion.usage.completion_tokens, 'tokens', {
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
 });
 }

 const responseMessage = completion.choices[0].message;

 // Check if the AI wants to call a function/tool
 if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
 const toolCall = responseMessage.tool_calls[0];
 const functionName = toolCall.function.name;
 const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

 msgLogger.info('AI tool call requested', {
 function: functionName,
 argKeys: Object.keys(functionArgs),
 llmDuration
 });

 // Handle workflow generation specially
 if (functionName === 'generate_workflow') {
 const result = await parseNaturalLanguage(functionArgs.description, context);
 const duration = Date.now() - startTime;

 msgLogger.performance('ai.agent.workflow_generation', duration, {
 category: 'ai_agent',
 success: result.success,
 nodeCount: result.workflow?.nodes?.length
 });

 msgLogger.metric('ai.workflow.generated', 1, 'count', {
 success: result.success,
 nodeCount: result.workflow?.nodes?.length || 0
 });

 return {
 type: 'workflow',
 ...result
 };
 }

 // Execute the action
 const actionResult = await actionExecutor.executeAction(functionName, functionArgs, {
 userId: context.userId,
 userEmail: context.userEmail,
 timezone: context.timezone || 'UTC'
 });

 // Get a natural language response about the action result
 const followUpMessages = [
 ...messages,
 responseMessage,
 {
 role: 'tool',
 tool_call_id: toolCall.id,
 content: JSON.stringify(actionResult)
 }
 ];

 // Enhanced system prompt for follow-up to better format action results
 const followUpSystemPrompt = `You are a helpful AI assistant. When presenting action results:

SCRAPING RESULTS:
- If the user asked for headlines, titles, or lists: Extract and display them as a numbered or bulleted list
- Format data clearly and readably - don't show raw JSON or technical details
- For Hacker News headlines: Show each headline on a new line with a number
- For any list of items: Present them clearly, not as raw data
- If data extraction worked: Show the actual content in a friendly, readable format
- If extraction didn't work: Explain simply what happened and suggest alternatives

EMAIL RESULTS:
- If email was sent successfully: Confirm it was sent and to whom
- If email service isn't configured or failed: Explain that you've prepared a mailto link they can click to open their email client with the message ready
- Always mention the mailto link option when email sending isn't available
- Be helpful: "I've prepared your email! Click the button below to open your email client with your message ready to send."

Keep responses short, friendly, and actionable. Use plain English - no technical jargon.`;

 const followUp = await getOpenAI().chat.completions.create({
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 messages: [
 { role: 'system', content: followUpSystemPrompt },
 ...followUpMessages
 ],
 temperature: 0.7,
 max_tokens: 1000 // Increased to allow for longer formatted lists
 });

 const duration = Date.now() - startTime;

 msgLogger.performance('ai.agent.action_execution', duration, {
 category: 'ai_agent',
 action: functionName,
 success: actionResult.success
 });

 msgLogger.metric('ai.action.via_chat', 1, 'count', {
 action: functionName,
 success: actionResult.success
 });

 return {
 type: 'action',
 success: actionResult.success,
 action: functionName,
 actionResult: actionResult,
 message: followUp.choices[0].message.content,
 duration
 };
 }

 // No tool call - just a conversational response
 const duration = Date.now() - startTime;

 msgLogger.performance('ai.agent.conversation', duration, {
 category: 'ai_agent',
 type: 'conversation'
 });

 msgLogger.metric('ai.conversation.response', 1, 'count', {
 duration
 });

 return {
 type: 'conversation',
 success: true,
 message: responseMessage.content,
 duration
 };

 } catch (error) {
 const duration = Date.now() - startTime;

 msgLogger.error('AI message handling failed', error, {
 duration,
 messageLength: userMessage?.length
 });

 msgLogger.metric('ai.agent.error', 1, 'count', {
 errorType: error.constructor.name
 });

 return {
 type: 'error',
 success: false,
 message: 'Something went wrong. Please try again!',
 error: error.message
 };
 }
}

/**
 * Refine an existing workflow based on user feedback
 */
async function refineWorkflow(existingWorkflow, refinementRequest, context = {}) {
 try {
 const messages = [
 { role: 'system', content: SYSTEM_PROMPT },
 {
 role: 'assistant',
 content: JSON.stringify({
 workflow: existingWorkflow,
 explanation: 'This is the current workflow configuration.'
 })
 },
 {
 role: 'user',
 content: `Please modify the workflow: ${refinementRequest}`
 }
 ];

 const completion = await getOpenAI().chat.completions.create({
 model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
 messages,
 temperature: 0.7,
 max_tokens: 2000,
 response_format: { type: 'json_object' }
 });

 const responseContent = completion.choices[0].message.content;
 const parsedResponse = JSON.parse(responseContent);
 const enhancedWorkflow = enhanceWorkflow(parsedResponse.workflow);

 return {
 success: true,
 workflow: enhancedWorkflow,
 explanation: parsedResponse.explanation,
 suggestions: parsedResponse.suggestions || []
 };

 } catch (error) {
 logger.error('[AI Agent] Error refining workflow:', error);
 return {
 success: false,
 error: error.message
 };
 }
}

/**
 * Learn from user feedback on AI responses
 * Feedback is stored in the rag-node-ts service for future retrieval
 */
async function learnFromFeedback(userQuery, aiResponse, wasHelpful, feedback = '') {
 try {
 // Store feedback as knowledge in RAG service
 if (wasHelpful && aiResponse) {
 await ragClient.ingestText(
 `User asked: "${userQuery}"\nHelpful response: "${aiResponse}"`,
 `easyflow:feedback:${Date.now()}`,
 { type: 'conversation_feedback', wasHelpful, feedback }
 );
 }
 logger.info('[AI Agent] Feedback recorded in rag-node-ts', { wasHelpful });
 return { success: true };
 } catch (error) {
 logger.error('[AI Agent] Error learning from feedback:', error);
 return { success: false, error: error.message };
 }
}

/**
 * Seed the knowledge base with app knowledge
 * Uses YOUR rag-node-ts RAG service!
 */
async function initializeKnowledge() {
 try {
 // Check if RAG service is healthy
 const health = await ragClient.healthCheck();

 if (!health.success) {
 logger.error('[AI Agent] rag-node-ts service not available!', {
 url: ragClient.RAG_SERVICE_URL,
 hint: 'Start your RAG service with: cd /Users/ky/rag-node-ts && npm run dev'
 });
 return {
 success: false,
 error: 'rag-node-ts service unavailable',
 hint: 'Start your RAG service first'
 };
 }

 // Seed knowledge via YOUR RAG service
 logger.info('[AI Agent] Seeding knowledge via rag-node-ts...');
 const result = await ragClient.seedEasyFlowKnowledge();

 // Also seed integration knowledge
 try {
 const { addIntegrationKnowledge } = require('./addIntegrationKnowledge');
 const integrationResult = await addIntegrationKnowledge();
 if (integrationResult.success) {
 logger.info('[AI Agent] Integration knowledge seeded');
 }
 } catch (integrationError) {
 logger.warn('[AI Agent] Failed to seed integration knowledge:', integrationError);
 }

 logger.info('[AI Agent] Knowledge seeded to rag-node-ts', {
 successful: result.successful,
 failed: result.failed
 });

 return {
 success: result.success,
 method: 'rag-node-ts',
 successCount: result.successful,
 errorCount: result.failed,
 message: `Seeded ${result.successful} knowledge items to your RAG service`
 };

 } catch (error) {
 logger.error('[AI Agent] Error initializing knowledge:', error);
 return { success: false, error: error.message };
 }
}

/**
 * Add new knowledge to the AI
 * Uses YOUR rag-node-ts RAG service!
 */
async function addAppKnowledge(knowledge) {
 try {
 const result = await ragClient.ingestText(
 knowledge.content,
 `easyflow:${knowledge.category}:${knowledge.title.toLowerCase().replace(/\s+/g, '-')}`,
 {
 category: knowledge.category,
 title: knowledge.title,
 keywords: knowledge.keywords || []
 }
 );

 if (result.success) {
 logger.info('[AI Agent] Knowledge added to rag-node-ts', { title: knowledge.title });
 return result;
 }

 return { success: false, error: 'Failed to add knowledge to RAG service' };

 } catch (error) {
 logger.error('[AI Agent] Error adding knowledge:', error);
 return { success: false, error: error.message };
 }
}

// Knowledge categories for organizing content in rag-node-ts
const KNOWLEDGE_CATEGORIES = {
 WORKFLOW_STEPS: 'workflow_steps',
 APP_FEATURES: 'app_features',
 TROUBLESHOOTING: 'troubleshooting',
 BEST_PRACTICES: 'best_practices',
 FAQ: 'faq',
 USER_FEEDBACK: 'user_feedback'
};

module.exports = {
 handleMessage,
 parseNaturalLanguage,
 getSuggestions,
 refineWorkflow,
 isWorkflowRequest,
 learnFromFeedback,
 initializeKnowledge,
 addAppKnowledge,
 WORKFLOW_STEPS,
 KNOWLEDGE_CATEGORIES
};

