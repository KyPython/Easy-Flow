/**
 * RAG Service Client
 *
 * Integrates Easy-Flow with the rag-node-ts RAG service.
 * This client allows Easy-Flow's AI Agent to:
 * 1. Query the RAG system for relevant knowledge
 * 2. Ingest new knowledge (docs, help content, workflow info)
 * 3. Manage the knowledge base
 *
 * Configuration via environment variables:
 * - RAG_SERVICE_URL: URL of the rag-node-ts service (default: http://localhost:3001)
 * - RAG_API_KEY: API key for authentication
 *
 * OBSERVABILITY:
 * - All logs flow through structured logging with trace context
 * - Trace headers propagated to RAG service for distributed tracing
 * - Performance metrics for RAG query latency
 */

const axios = require('axios');
const { createLogger } = require('../middleware/structuredLogging');
const { getTraceHeaders } = require('../middleware/traceContext');

// Namespaced logger for RAG Client
const logger = createLogger('ai.rag');

// Configuration
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:3001';
const RAG_API_KEY = process.env.RAG_API_KEY || 'sk_rag_easyflow_dev';
const RAG_TIMEOUT = parseInt(process.env.RAG_TIMEOUT || '30000', 10);

// Create axios instance with defaults
const ragApi = axios.create({
 baseURL: RAG_SERVICE_URL,
 timeout: RAG_TIMEOUT,
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${RAG_API_KEY}`
 }
});

// Add request/response logging with trace propagation
ragApi.interceptors.request.use(
 (config) => {
 // Inject trace headers for distributed tracing
 const traceHeaders = getTraceHeaders();
 config.headers = {
 ...config.headers,
 ...traceHeaders
 };

 // Store request start time for performance logging
 config.metadata = { startTime: Date.now() };

 logger.debug('RAG service request', {
 method: config.method?.toUpperCase(),
 url: config.url,
 traceId: traceHeaders['x-trace-id']
 });
 return config;
 },
 (error) => {
 logger.error('RAG service request error', error, {
 url: error.config?.url
 });
 return Promise.reject(error);
 }
);

ragApi.interceptors.response.use(
 (response) => {
 const duration = response.config.metadata?.startTime
 ? Date.now() - response.config.metadata.startTime
 : null;

 logger.debug('RAG service response', {
 status: response.status,
 url: response.config.url,
 duration
 });

 // Log performance metric for all RAG calls
 if (duration) {
 logger.performance('ai.rag.request', duration, {
 category: 'external_service',
 url: response.config.url,
 status: response.status
 });
 }

 return response;
 },
 (error) => {
 const duration = error.config?.metadata?.startTime
 ? Date.now() - error.config.metadata.startTime
 : null;

 logger.error('RAG service response error', error, {
 status: error.response?.status,
 url: error.config?.url,
 duration
 });
 return Promise.reject(error);
 }
);

/**
 * Query the RAG system for relevant knowledge
 *
 * @param {string} query - The question or search query
 * @param {object} options - Query options
 * @param {number} options.topK - Number of passages to retrieve (default: 5)
 * @param {string} options.mode - 'answer' (full RAG) or 'retrieval' (passages only)
 * @param {boolean} options.useCache - Whether to use caching (default: true)
 * @returns {Promise<object>} RAG response with answer and/or passages
 */
async function query(queryText, options = {}) {
 const { topK = 5, mode = 'answer', useCache = true } = options;
 const startTime = Date.now();
 const queryLogger = logger.withOperation('ai.rag.query', { mode, topK });

 try {
 const response = await ragApi.post('/query', {
 query: queryText,
 topK
 }, {
 params: {
 mode,
 cacheMode: useCache ? 'on' : 'off'
 }
 });

 const data = response.data?.data || response.data;
 const duration = Date.now() - startTime;
 const cached = response.data?._cached || false;

 // Performance metric for RAG queries
 queryLogger.performance('ai.rag.query', duration, {
 category: 'ai_rag',
 mode,
 citationsCount: data.citations?.length || 0,
 cached
 });

 // Business metric for RAG usage tracking
 queryLogger.metric('ai.rag.query', 1, 'count', {
 mode,
 cached,
 citationsFound: (data.citations?.length || 0) > 0,
 duration
 });

 queryLogger.info('RAG query completed', {
 queryPreview: queryText.slice(0, 50),
 mode,
 citationsCount: data.citations?.length || 0,
 cached,
 duration
 });

 return {
 success: true,
 answer: data.answer,
 citations: data.citations || [],
 results: data.results || [],
 cached
 };

 } catch (error) {
 const duration = Date.now() - startTime;

 queryLogger.error('RAG query failed', error, {
 queryPreview: queryText.slice(0, 50),
 mode,
 duration
 });

 // Track failed queries
 queryLogger.metric('ai.rag.query.failed', 1, 'count', {
 mode,
 errorType: error.response?.status || 'network'
 });

 return {
 success: false,
 error: error.message,
 answer: null,
 citations: []
 };
 }
}

/**
 * Ingest text content into the RAG knowledge base
 *
 * @param {string} text - The text content to ingest
 * @param {string} source - Source identifier (e.g., "easyflow:workflow-help")
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} Ingestion result
 */
async function ingestText(text, source, metadata = {}) {
 const startTime = Date.now();
 const ingestLogger = logger.withOperation('ai.rag.ingest', { source });

 try {
 const response = await ragApi.post('/ingest/text', {
 text,
 source,
 metadata
 });

 const data = response.data?.data || response.data;
 const duration = Date.now() - startTime;

 ingestLogger.performance('ai.rag.ingest', duration, {
 category: 'ai_rag',
 source,
 chunksProcessed: data.chunksProcessed
 });

 ingestLogger.metric('ai.rag.ingest', data.chunksProcessed || 1, 'chunks', {
 source
 });

 ingestLogger.info('Text ingested to RAG', {
 source,
 chunksProcessed: data.chunksProcessed,
 textLength: text.length,
 duration
 });

 return {
 success: true,
 chunksProcessed: data.chunksProcessed,
 source: data.source
 };

 } catch (error) {
 ingestLogger.error('RAG ingest failed', error, {
 source,
 textLength: text.length
 });

 return {
 success: false,
 error: error.message
 };
 }
}

/**
 * Batch ingest multiple documents
 *
 * @param {Array<{text: string, source: string, metadata?: object}>} documents
 * @returns {Promise<object>} Batch ingestion result
 */
async function ingestBatch(documents) {
 try {
 const response = await ragApi.post('/ingest/batch', {
 documents
 });

 const data = response.data?.data || response.data;

 logger.info('[RAG Client] Batch ingestion completed', {
 total: data.total,
 successful: data.successful,
 failed: data.failed
 });

 return {
 success: data.failed === 0,
 total: data.total,
 successful: data.successful,
 failed: data.failed,
 results: data.results
 };

 } catch (error) {
 logger.error('[RAG Client] Batch ingest failed', {
 documentCount: documents.length,
 error: error.message
 });

 return {
 success: false,
 error: error.message
 };
 }
}

/**
 * Check RAG service health
 *
 * @returns {Promise<object>} Health status
 */
async function healthCheck() {
 try {
 const response = await ragApi.get('/health');
 return {
 success: true,
 status: response.data?.status || 'ok',
 timestamp: response.data?.timestamp
 };
 } catch (error) {
 return {
 success: false,
 status: 'unhealthy',
 error: error.message
 };
 }
}

/**
 * Clear all documents in the namespace (for re-indexing)
 *
 * @returns {Promise<object>} Deletion result
 */
async function clearNamespace() {
 try {
 const response = await ragApi.delete('/ingest/namespace');

 logger.info('[RAG Client] Namespace cleared');

 return {
 success: true,
 message: response.data?.data?.message
 };

 } catch (error) {
 logger.error('[RAG Client] Clear namespace failed', {
 error: error.message
 });

 return {
 success: false,
 error: error.message
 };
 }
}

/**
 * Seed the RAG knowledge base with Easy-Flow app knowledge
 * Call this on startup or after app updates
 */
async function seedEasyFlowKnowledge() {
 const knowledge = [
 // Workflow Steps
 {
 text: 'The Start step is the entry point for every workflow in Easy-Flow. It must be the first step and all workflows require exactly one Start step. The Start step has no configuration - it simply marks where the workflow begins execution.',
 source: 'easyflow:help:start-step',
 metadata: { category: 'workflow_steps', step: 'start' }
 },
 {
 text: 'The Web Scraping step extracts data from websites. Configure it with: URL - the webpage to scrape, CSS Selectors - to target specific elements (e.g., \'.price\', \'#product-title\'), Timeout - how long to wait (default 30s). The step uses Puppeteer for JavaScript-rendered pages.',
 source: 'easyflow:help:web-scrape-step',
 metadata: { category: 'workflow_steps', step: 'web_scrape' }
 },
 {
 text: 'The API Request step makes HTTP calls to external services. Configure: Method - GET, POST, PUT, DELETE, URL - the API endpoint, Headers - including Authorization, Body - for POST/PUT requests (JSON format). Use this for integrating with external services or webhooks.',
 source: 'easyflow:help:api-step',
 metadata: { category: 'workflow_steps', step: 'api_call' }
 },
 {
 text: 'The Send Email step sends email notifications via SendGrid. Configure: To - recipient email(s), Subject - can include variables like {{data.field}}, Template - email body supports HTML and variables. Variables from previous steps are available using {{stepName.field}} syntax.',
 source: 'easyflow:help:email-step',
 metadata: { category: 'workflow_steps', step: 'email' }
 },
 {
 text: 'The Transform Data step processes and transforms data between steps. Supports field mapping (rename/restructure), filters (include/exclude based on conditions), aggregations (count, sum, average), and format conversion (JSON to CSV). Use JavaScript expressions for complex transformations.',
 source: 'easyflow:help:transform-step',
 metadata: { category: 'workflow_steps', step: 'data_transform' }
 },
 {
 text: 'The Condition step branches workflow execution based on conditions. Configure conditions using field path, operator (equals, contains, greater than), and value. Multiple conditions can be combined with AND/OR. Has two outputs: \'true\' branch and \'false\' branch.',
 source: 'easyflow:help:condition-step',
 metadata: { category: 'workflow_steps', step: 'condition' }
 },
 {
 text: 'The Delay step pauses workflow execution for a specified duration. Configure duration in seconds (1-300). Use for rate limiting between API calls, waiting for external processes, or spacing out emails to avoid spam filters.',
 source: 'easyflow:help:delay-step',
 metadata: { category: 'workflow_steps', step: 'delay' }
 },
 {
 text: 'The End step marks workflow completion. Configure success/failure status and completion message. A workflow can have multiple End steps for different outcomes. When reached, the workflow completes and final status is recorded.',
 source: 'easyflow:help:end-step',
 metadata: { category: 'workflow_steps', step: 'end' }
 },

 // App Features
 {
 text: 'The Workflow Builder is a visual drag-and-drop canvas for creating automations. Drag steps from the Actions toolbar on the left, connect steps by dragging handles, click steps to configure in the side panel. Auto-save keeps your work safe. Keyboard shortcuts: Delete to remove, Ctrl+S to save.',
 source: 'easyflow:help:workflow-builder',
 metadata: { category: 'app_features' }
 },
 {
 text: 'Workflows can be scheduled to run automatically. Access via the Schedules tab. Options: One-time (specific datetime), Recurring (daily, weekly, monthly, or cron expression), with timezone support. Scheduled workflows run in the background.',
 source: 'easyflow:help:scheduling',
 metadata: { category: 'app_features' }
 },
 {
 text: 'Templates are pre-built workflows for common use cases. Access via Templates button. Categories: Web Scraping, Email Automation, Data Processing, Monitoring. Click \'Use Template\' to create your own copy that you can customize.',
 source: 'easyflow:help:templates',
 metadata: { category: 'app_features' }
 },

 // Troubleshooting
 {
 text: 'If your workflow won\'t run, check: Is the workflow Active? (click Activate if Draft), Does it have a Start step?, Are all steps connected?, Is it saved? Check plan limits if you\'ve hit your monthly runs. Look at the error message for specific guidance.',
 source: 'easyflow:help:troubleshooting-not-running',
 metadata: { category: 'troubleshooting' }
 },
 {
 text: 'Web scraping issues: Timeout - increase timeout or check if site is blocking, Empty results - verify CSS selectors on the actual page, Blocked - some sites block scrapers try adding delays, JavaScript content - page may need time to load add wait time, Login required - use API step instead.',
 source: 'easyflow:help:troubleshooting-scraping',
 metadata: { category: 'troubleshooting' }
 },
 {
 text: 'Email issues: Check recipient address is valid, Check spam folder, Verify your plan has email sends remaining, Template errors - make sure {{variables}} match actual data fields, Large attachments - keep under 10MB. Delivery can take 1-5 minutes.',
 source: 'easyflow:help:troubleshooting-email',
 metadata: { category: 'troubleshooting' }
 },

 // FAQ
 {
 text: 'Workflow limits by plan: Hobbyist - 0 workflows (tasks only), Starter - 3 active workflows, Professional - 10 workflows, Business - 50 workflows, Enterprise - unlimited. Archived workflows don\'t count toward limits.',
 source: 'easyflow:help:faq-limits',
 metadata: { category: 'faq' }
 },
 {
 text: 'Execution limits by plan: Hobbyist - 50 runs/month, Starter - 500 runs/month, Professional - 2000 runs/month, Business - 10000 runs/month, Enterprise - unlimited. Each workflow execution counts as one run.',
 source: 'easyflow:help:faq-runs',
 metadata: { category: 'faq' }
 },
 {
 text: 'Easy-Flow security: All data encrypted in transit (HTTPS/TLS) and at rest, API keys stored securely never exposed to browser, Row-level security ensures data isolation, No workflow data shared between users, SOC2 compliance in progress.',
 source: 'easyflow:help:faq-security',
 metadata: { category: 'faq' }
 },

 // NEW FEATURES (2025)
 {
 text: 'Bookmarklet for Vendor Portal Automation: Users can download invoices from vendor portals with one click! When on a vendor portal, users can click a bookmarklet button that automatically opens EasyFlow with the current page URL pre-filled and task type set to "invoice_download". This eliminates the need to switch tabs and manually copy URLs. The bookmarklet is available in the AI assistant when users mention "vendor portal" or "invoice download".',
 source: 'easyflow:feature:bookmarklet',
 metadata: { category: 'features', feature: 'bookmarklet', date: '2025' }
 },
 {
 text: 'Auto-Scroll and Smart Navigation: EasyFlow now automatically scrolls to relevant content to reduce manual scrolling. When validation errors occur, the app scrolls to the first error field. When discovery results appear, it scrolls to show them. When new runs are added to history, it scrolls to the top. The app also auto-redirects after task submission (2 seconds) and from task result modals (5 seconds with countdown). Smart login redirects remember where users wanted to go before logging in.',
 source: 'easyflow:feature:auto-scroll',
 metadata: { category: 'features', feature: 'ux', date: '2025' }
 },
 {
 text: 'Plain English UI: All technical jargon has been replaced with user-friendly plain English labels. "CSS Selectors" is now "What parts of the page should we grab?", "HTTP Method" is "What should we do?", "API URL" is "Website or service address (URL)", and "Request Body (JSON)" is "What data should we send?". The AI assistant should match this friendly, non-technical communication style in all responses.',
 source: 'easyflow:feature:plain-english-ui',
 metadata: { category: 'features', feature: 'ux', date: '2025' }
 },
 {
 text: 'AI-Powered Data Extraction: Users can enable FREE AI extraction when creating tasks. After a task completes (invoice download or web scraping), the AI automatically extracts structured data from PDFs or HTML based on user-defined targets. Results are stored in the automation_runs table with confidence scores. This feature is available to all users for free.',
 source: 'easyflow:feature:ai-extraction',
 metadata: { category: 'features', feature: 'ai', date: '2025' }
 },
 {
 text: 'Improved Link Discovery UX: When downloading invoices, users can click "Find Available Buttons" to see all clickable links on a page. Each discovered link is shown as a clickable button that auto-fills the "Link Text" field when clicked. This eliminates the need to manually inspect websites or type link text. The discovery test always uses auto-detect mode to show all available links.',
 source: 'easyflow:feature:link-discovery',
 metadata: { category: 'features', feature: 'ux', date: '2025' }
 },
 {
 text: 'Enhanced Error Handling: Errors now automatically scroll to and focus on the problem field. Error messages use plain English and focus on what to do next rather than technical details. Environment-aware messages adapt based on development vs production. All user-facing error messages are sanitized to remove sensitive information.',
 source: 'easyflow:feature:error-handling',
 metadata: { category: 'features', feature: 'ux', date: '2025' }
 },

 // TASK CONFIGURATION - COMPREHENSIVE GUIDE
 {
 text: 'Task Configuration - Invoice Download: To configure an invoice download task, you need: 1) Target URL - the vendor portal URL where invoices are located, 2) Username/Email - login credentials if the site requires authentication, 3) Password - login password (securely stored), 4) Discovery Method - choose "Auto-detect" (recommended, works 99% of the time) or "Find by Link Text" (if auto-detect fails), 5) Link Text - if using text-match, specify the exact button text like "Download PDF" or "Invoice" (users can click "Find Available Buttons" to see all options), 6) AI Extraction (optional, FREE) - enable to automatically extract structured data from downloaded PDFs. After submission, the task runs automatically and results appear in Automation History. The app auto-redirects to history after 2 seconds.',
 source: 'easyflow:help:task-config-invoice',
 metadata: { category: 'task_configuration', task_type: 'invoice_download' }
 },
 {
 text: 'Task Configuration - Web Scraping: To configure a web scraping task, you need: 1) Target URL - the webpage to scrape, 2) Username/Email - if login required, 3) Password - if login required, 4) What parts of the page should we grab? - specify CSS selectors like ".price", "#product-title", "h1", "h2" (the UI uses plain English: "What parts of the page should we grab?" instead of "CSS Selectors"), 5) AI Extraction (optional, FREE) - enable to extract structured data from scraped HTML. Format extraction targets as "field_name: description" (one per line), e.g., "product_name: Name of the product", "price: Product price". The AI will automatically extract these fields after scraping completes.',
 source: 'easyflow:help:task-config-scraping',
 metadata: { category: 'task_configuration', task_type: 'web_scraping' }
 },
 {
 text: 'Task Configuration - Form Submission: To configure a form submission task, you need: 1) Target URL - the webpage URL containing the form to submit, 2) Username/Email - if the site requires login before accessing the form, 3) Password - if login required, 4) Form Data - the form fields and values to submit (this is handled by the automation worker which will find and fill the form on the page). The task type is "form_submission" and the worker uses Puppeteer to navigate to the URL, find form elements, fill them with provided data, and submit. Form data is typically provided as key-value pairs where keys match form field names (name, id, or label) and values are what to enter.',
 source: 'easyflow:help:task-config-form',
 metadata: { category: 'task_configuration', task_type: 'form_submission' }
 },
 {
 text: 'AI Extraction Configuration: When creating any task, users can enable "AI-Powered Web Scraping" (FREE for everyone). This feature automatically extracts structured data after the task completes. Configuration: 1) Enable the checkbox "Enable AI-Powered Web Scraping", 2) In "What data should we extract?" textarea, specify extraction targets in format "field_name: description" (one per line), e.g., "vendor_name: Company name", "invoice_amount: Total amount due", "due_date: Payment due date". The textarea auto-formats as you type (adds ": " when pressing Enter). After task completion, the AI processes the artifact (PDF or HTML) and extracts the specified fields. Results are stored in automation_runs with confidence scores. This uses the same AI model as the chatbot.',
 source: 'easyflow:help:ai-extraction-config',
 metadata: { category: 'task_configuration', feature: 'ai_extraction' }
 },
 {
 text: 'Link Discovery for Invoice Downloads: When configuring invoice downloads, users can discover available download links without manually inspecting the website. Process: 1) Enter the vendor portal URL, 2) Click "Find Available Buttons" (prominently displayed when "Find by Link Text" method is selected), 3) The system scans the page and shows all clickable links as interactive buttons, 4) Each button shows the link text, URL, and confidence score, 5) Click any button to auto-fill the "Link Text" field. The discovery test always uses auto-detect mode to show ALL available links, regardless of the selected discovery method. This eliminates tab switching and manual inspection.',
 source: 'easyflow:help:link-discovery-config',
 metadata: { category: 'task_configuration', feature: 'link_discovery' }
 },
 {
 text: 'Bookmarklet for Vendor Portals: The easiest way to start an invoice download task is using the bookmarklet. How it works: 1) When user mentions "vendor portal" or "invoice download" to the AI assistant, the assistant provides a draggable bookmarklet button, 2) User drags the button to their browser bookmarks bar, 3) When on their vendor portal, user clicks the bookmarklet, 4) EasyFlow opens in a new tab with the current page URL pre-filled and task type set to "invoice_download", 5) User just adds login credentials and clicks "Run Automation". The bookmarklet code is: javascript:(function(){const url=encodeURIComponent(window.location.href);const base=window.location.hostname===\'localhost\'?\'http://localhost:3000\':\'https://app.useeasyflow.com\';window.open(base+\'/app/tasks?url=\'+url+\'&task=invoice_download\',\'_blank\');alert(\'🚀 Opening EasyFlow with this page\'s URL!\n\nJust add your login credentials and click "Run Automation".\');})();',
 source: 'easyflow:help:bookmarklet-usage',
 metadata: { category: 'task_configuration', feature: 'bookmarklet' }
 },
 {
 text: 'Task Submission Flow: After configuring a task, clicking "Run Automation" submits it to the backend. The app: 1) Validates all required fields (URL is always required), 2) Shows validation errors with auto-scroll to the first error field, 3) Submits to /api/automation/execute (or /api/run-task-with-ai if AI extraction is enabled), 4) Creates records in automation_tasks and automation_runs tables, 5) Queues the task to the automation worker via Kafka, 6) Shows success message with task ID, 7) Auto-redirects to /app/history after 2 seconds. The task appears in Automation History with status "queued", then "running", then "completed" or "failed". Users can view results, download artifacts (PDFs), and see AI-extracted data if enabled.',
 source: 'easyflow:help:task-submission-flow',
 metadata: { category: 'task_configuration', feature: 'submission' }
 },
 {
 text: 'Task Types Available: EasyFlow supports three main task types: 1) invoice_download - Downloads PDF invoices from vendor portals, supports auto-detect and text-match link discovery, requires URL and optionally login credentials, 2) web_scraping - Extracts data from web pages using CSS selectors, requires URL and selectors, optionally login credentials, 3) form_submission - Submits forms on websites, requires URL, form data, and optionally login credentials. All task types support AI extraction for structured data extraction. Tasks are one-time executions (unlike workflows which can be scheduled).',
 source: 'easyflow:help:task-types',
 metadata: { category: 'task_configuration', feature: 'task_types' }
 },
 {
 text: 'Task Form Fields Explained (Plain English): The task form uses user-friendly labels: "Target Website Setup" section has "Website URL" (the page to automate), "Username/Email" (only if login required), "Password" (only if login required, securely stored). "Automatic PDF Discovery" section has discovery method dropdown with "Auto-detect (Recommended)" and "Find by Link Text", "Which button should we click?" (the link text field, with helper text guiding users to click "Find Available Buttons" first), "Find Available Buttons" button (scans page and shows all clickable links). "AI-Powered Web Scraping" section has checkbox "Enable AI-Powered Web Scraping ✨ Free", "What information do you want?" textarea (with helper text "Type what you want -> Press Enter -> Type what it means"). All fields have helpful tooltips explaining what they do.',
 source: 'easyflow:help:task-form-fields',
 metadata: { category: 'task_configuration', feature: 'ui' }
 },
 {
 text: 'How to Help Users Configure Tasks: When users ask to create a task, guide them through: 1) Identify the task type (invoice download, web scraping, or form submission), 2) Get the target URL (or suggest bookmarklet for vendor portals), 3) Determine if login is required (ask for credentials if needed), 4) For invoice downloads: recommend auto-detect first, if that fails suggest "Find Available Buttons" to discover link text, 5) For web scraping: ask what data they want to extract, then suggest appropriate selectors (e.g., ".price" for prices, "h1" for titles), 6) For form submission: ask what form fields need to be filled (e.g., name, email, message) and their values, 7) Suggest enabling AI extraction if they want structured data, 8) Explain the extraction targets format: "field_name: description" (one per line), 9) Confirm all details before they submit. Always use plain English, avoid technical jargon.',
 source: 'easyflow:help:guide-task-config',
 metadata: { category: 'task_configuration', feature: 'guidance' }
 },

 // WORKFLOW CONFIGURATION - COMPREHENSIVE GUIDE
 {
 text: 'Workflow Builder Overview: The Workflow Builder is a visual drag-and-drop canvas for creating multi-step automations. Access it via /app/workflows. Steps are dragged from the Actions toolbar on the left onto the canvas. Steps are connected by dragging from output handles to input handles. Click any step to configure it in the side panel. Workflows auto-save as you work. Keyboard shortcuts: Delete key removes selected step, Ctrl+S saves. Workflows can be run immediately or scheduled for recurring execution.',
 source: 'easyflow:help:workflow-builder-overview',
 metadata: { category: 'workflow_configuration', feature: 'workflow_builder' }
 },
 {
 text: 'Workflow Steps Available: 1) Start - Entry point (required, no config), 2) Web Scraping - Extract data from websites (config: URL, CSS selectors, timeout), 3) API Request - Make HTTP calls (config: method GET/POST/PUT/DELETE, URL, headers, body), 4) Transform Data - Process data between steps (config: transformations, output format JSON/CSV/text), 5) Condition - Branch workflow based on conditions (config: conditions array, AND/OR operator), 6) Send Email - Email notifications (config: to addresses, subject, template with variables), 7) Upload File - Save files to storage (config: destination, source field, filename), 8) Delay - Pause execution (config: duration in seconds), 9) End - Mark completion (config: success status, message). All steps except Start/End have configuration panels accessible by clicking the step.',
 source: 'easyflow:help:workflow-steps',
 metadata: { category: 'workflow_configuration', feature: 'workflow_steps' }
 },
 {
 text: 'Workflow Step Configuration - Web Scraping: Configure with: URL (the webpage to scrape), CSS Selectors (array of selectors like ".price", "#title", "h1" - UI shows "What parts of the page should we grab?"), Timeout (seconds, default 30), Retries (max attempts, base backoff in ms). The step extracts data matching the selectors and passes it to the next step. Variables from previous steps can be used in the URL using {{stepName.field}} syntax.',
 source: 'easyflow:help:workflow-step-web-scrape',
 metadata: { category: 'workflow_configuration', step: 'web_scrape' }
 },
 {
 text: 'Workflow Step Configuration - API Request: Configure with: Method (GET/POST/PUT/DELETE - UI shows "What should we do?"), URL (the API endpoint - UI shows "Website or service address (URL)"), Headers (key-value pairs for authentication, content-type, etc.), Body (for POST/PUT - UI shows "What data should we send?" in JSON format). Variables from previous steps can be used in URL, headers, and body using {{stepName.field}} syntax. Supports timeout and retry configuration.',
 source: 'easyflow:help:workflow-step-api-call',
 metadata: { category: 'workflow_configuration', step: 'api_call' }
 },
 {
 text: 'Workflow Step Configuration - Send Email: Configure with: To (array of recipient email addresses), Subject (can include variables like {{data.field}}), Template (email body, supports HTML and variables). Variables from previous steps are available using {{stepName.field}} syntax. For example, if a web scraping step extracted "price", you can use {{web_scrape.price}} in the email template. Emails are sent via SendGrid.',
 source: 'easyflow:help:workflow-step-email',
 metadata: { category: 'workflow_configuration', step: 'email' }
 },
 {
 text: 'Workflow Step Configuration - Transform Data: Configure with: Transformations (array of transformation rules), Output Format (JSON, CSV, or text). Transformations can: rename fields, filter data (include/exclude based on conditions), aggregate (count, sum, average), convert formats. Use JavaScript expressions for complex transformations. Output is passed to the next step.',
 source: 'easyflow:help:workflow-step-transform',
 metadata: { category: 'workflow_configuration', step: 'data_transform' }
 },
 {
 text: 'Workflow Step Configuration - Condition: Configure with: Conditions (array of condition objects with field path, operator equals/contains/greater than, and value), Operator (AND or OR to combine conditions). Has two outputs: \'true\' branch (when conditions match) and \'false\' branch (when conditions don\'t match). Use field paths like "data.price" or "stepName.field" to reference data from previous steps.',
 source: 'easyflow:help:workflow-step-condition',
 metadata: { category: 'workflow_configuration', step: 'condition' }
 },
 {
 text: 'Workflow Scheduling: Workflows can be scheduled to run automatically. Access via the Schedules tab in the workflow builder. Options: One-time (specific datetime), Recurring (daily, weekly, monthly, or custom cron expression), with timezone support. Scheduled workflows run in the background. Users can pause/resume schedules. Plan limits apply - Starter plan may have limited scheduling.',
 source: 'easyflow:help:workflow-scheduling',
 metadata: { category: 'workflow_configuration', feature: 'scheduling' }
 },
 {
 text: 'Workflow Templates: Pre-built workflows for common use cases. Access via Templates button in workflow builder. Categories: Web Scraping, Email Automation, Data Processing, Monitoring. Click \'Use Template\' to create your own copy that you can customize. Templates provide starting points but can be fully modified.',
 source: 'easyflow:help:workflow-templates',
 metadata: { category: 'workflow_configuration', feature: 'templates' }
 },

 // APP NAVIGATION AND STRUCTURE
 {
 text: 'EasyFlow App Navigation: Main navigation links: Dashboard (/app) - shows EasyFlow app status (automation runs, workflows, schedules, metrics), Status (/app/unified-dashboard) - shows external tools/integrations status, Task Management (/app/tasks) - create one-time automation tasks, Automation History (/app/history) - view all task runs and results, Files (/app/files) - manage uploaded/downloaded files, Workflows (/app/workflows) - create and manage multi-step workflows, Rules (/app/rules) - business rules for workflows, Bulk Processing (/app/bulk-processor) - process multiple files, Analytics (/app/analytics) - usage analytics and reports, Integrations (/app/integrations) - connect external tools (Slack, Gmail, etc.), Settings (/app/settings) - account and preferences.',
 source: 'easyflow:help:app-navigation',
 metadata: { category: 'app_structure', feature: 'navigation' }
 },
 {
 text: 'Dashboard vs Unified Dashboard: The Dashboard (/app) shows EasyFlow app-specific status: automation runs (queued, running, completed, failed), workflows (active, paused, draft), schedules (active schedules with next run times), metrics (total tasks, time saved, documents processed), recent activity. The Unified Dashboard (/app/unified-dashboard) shows external tools status: integration connections (Slack, Gmail, Google Sheets, etc.), connection health (connected, inactive, error), test status for each integration, overall system health score. These are separate pages - Dashboard is for EasyFlow app data, Unified Dashboard is for external tools.',
 source: 'easyflow:help:dashboard-separation',
 metadata: { category: 'app_structure', feature: 'dashboards' }
 },
 {
 text: 'Task Management Page: Located at /app/tasks. This is where users create one-time automation tasks. The page contains the TaskForm component with fields: Task Type dropdown (Invoice Download, Web Scraping, Form Submission), Target URL (required), Username/Email (if login needed), Password (if login needed), Discovery Method (for invoice downloads - auto-detect or text-match), Link Text (if using text-match), AI Extraction checkbox and extraction targets textarea. After submission, users are auto-redirected to /app/history after 2 seconds. The page supports URL parameters: ?url=...&task=... to pre-fill the form (used by bookmarklet).',
 source: 'easyflow:help:task-management-page',
 metadata: { category: 'app_structure', feature: 'tasks_page' }
 },
 {
 text: 'Automation History Page: Located at /app/history. Shows all automation runs with: status (queued, running, completed, failed), task name and type, URL, start time, completion time, results, artifacts (downloadable PDFs), AI-extracted data (if enabled). Supports filtering by status, searching, sorting. Real-time updates via Supabase Realtime subscriptions. New runs auto-scroll to top of list. Click any run to view detailed results in a modal.',
 source: 'easyflow:help:history-page',
 metadata: { category: 'app_structure', feature: 'history_page' }
 },
 {
 text: 'Workflow Builder Page: Located at /app/workflows. Visual drag-and-drop canvas for creating workflows. Left sidebar: Actions toolbar with all available steps (Start, Web Scraping, API Request, etc.). Center: Canvas where steps are placed and connected. Right sidebar: Step configuration panel (opens when clicking a step). Top toolbar: Save, Run, Schedule, Templates buttons. Workflows auto-save as you work. Can run immediately or schedule for recurring execution.',
 source: 'easyflow:help:workflow-builder-page',
 metadata: { category: 'app_structure', feature: 'workflow_builder' }
 },

 // APP FEATURES AND CAPABILITIES
 {
 text: 'AI Assistant: Available globally via toggle button in the header. Provides: Quick Actions (scrape websites, send emails, create tasks), Workflow Building (describe automations in natural language), Help and Support (answer questions, troubleshoot). Uses OpenAI GPT-4 with function calling to execute actions. Has access to: create_task, run_task, list_tasks, scrape_website, send_email, create_automated_workflow, generate_workflow, list_workflows, check_account_status, contact_support. Quick start examples: Download Invoices, Scrape Website, Submit Form, Build Workflow, Get Help.',
 source: 'easyflow:help:ai-assistant',
 metadata: { category: 'app_features', feature: 'ai_assistant' }
 },
 {
 text: 'File Management: Located at /app/files. Users can: upload files, view uploaded files, download files, share files via public links, manage file storage. Files are stored in Supabase Storage. Supports various file types. Files can be used in workflows (file_upload step) or downloaded as artifacts from automation runs.',
 source: 'easyflow:help:file-management',
 metadata: { category: 'app_features', feature: 'files' }
 },
 {
 text: 'Business Rules: Located at /app/rules. Users can create reusable business rules for workflow conditions. Rules define conditions that can be reused across multiple workflows. Rules have: name, description, conditions (field, operator, value), operator (AND/OR). Rules can be selected in Condition steps instead of manually entering conditions. Makes workflows more maintainable.',
 source: 'easyflow:help:business-rules',
 metadata: { category: 'app_features', feature: 'rules' }
 },
 {
 text: 'Bulk Processing: Located at /app/bulk-processor. Process multiple files at once. Upload multiple files, configure processing options, run batch operations. Useful for processing invoices, documents, or data files in bulk. Results are available in Automation History.',
 source: 'easyflow:help:bulk-processing',
 metadata: { category: 'app_features', feature: 'bulk_processor' }
 },
 {
 text: 'Analytics: Located at /app/analytics. Shows usage analytics: total tasks run, success rate, time saved, documents processed, workflow executions, integration usage. Provides insights into automation performance. Plan limits may apply for advanced analytics.',
 source: 'easyflow:help:analytics',
 metadata: { category: 'app_features', feature: 'analytics' }
 },
 {
 text: 'Integrations: Located at /app/integrations. Connect external tools: Slack (send messages, read channels), Gmail (send emails, read inbox), Google Sheets (read/write data), Google Meet (transcribe recordings), WhatsApp (send messages), Notion (read/write pages). Each integration requires OAuth authentication. Connection status shown in Unified Dashboard. Integrations enable workflows to interact with external services.',
 source: 'easyflow:help:integrations',
 metadata: { category: 'app_features', feature: 'integrations' }
 },

 // ERROR HANDLING AND TROUBLESHOOTING
 {
 text: 'Error Handling in EasyFlow: Errors use plain English messages focused on what to do next. Validation errors auto-scroll to the first error field. All user-facing errors are sanitized to remove sensitive information. Environment-aware messages adapt based on development vs production. Common errors: "Target URL is required" (user needs to enter a URL), "Link text is required for this discovery method" (user needs to specify link text or use auto-detect), "Please enter a valid URL" (URL format is incorrect), "The website blocked our request" (site may require different approach). Errors are logged with structured logging for observability.',
 source: 'easyflow:help:error-handling',
 metadata: { category: 'troubleshooting', feature: 'errors' }
 },
 {
 text: 'Task Troubleshooting: If task fails: Check Automation History for error details, verify URL is correct and accessible, check if login credentials are correct, for invoice downloads try different discovery method, for web scraping verify selectors match the page structure, check if site requires JavaScript (may need different approach), verify network connectivity. Task statuses: queued (waiting to start), running (in progress), completed (success), failed (error occurred). Results and artifacts are available in Automation History.',
 source: 'easyflow:help:troubleshooting-tasks',
 metadata: { category: 'troubleshooting', feature: 'tasks' }
 },
 {
 text: 'Workflow Troubleshooting: If workflow won\'t run: Check if workflow is Active (not Draft), verify it has a Start step, ensure all steps are connected, check if workflow is saved, verify plan limits (monthly runs), check step configurations for errors, review execution logs in Automation History. Workflow statuses: active (can run), paused (suspended), draft (not ready), stopped (manually stopped).',
 source: 'easyflow:help:troubleshooting-workflows',
 metadata: { category: 'troubleshooting', feature: 'workflows' }
 }
 ];

 logger.info('[RAG Client] Seeding Easy-Flow knowledge...', {
 documentCount: knowledge.length
 });

 const result = await ingestBatch(knowledge);

 logger.info('[RAG Client] Knowledge seeding complete', {
 successful: result.successful,
 failed: result.failed
 });

 return result;
}

module.exports = {
 query,
 ingestText,
 ingestBatch,
 healthCheck,
 clearNamespace,
 seedEasyFlowKnowledge,
 RAG_SERVICE_URL
};

