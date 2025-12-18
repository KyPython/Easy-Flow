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
    'Authorization': `Bearer ${RAG_API_KEY}`,
  },
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
      topK,
    }, {
      params: {
        mode,
        cacheMode: useCache ? 'on' : 'off',
      },
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
      cached,
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
      citations: [],
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
      metadata,
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
      source: data.source,
    };

  } catch (error) {
    ingestLogger.error('RAG ingest failed', error, {
      source,
      textLength: text.length
    });

    return {
      success: false,
      error: error.message,
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
      documents,
    });

    const data = response.data?.data || response.data;

    logger.info('[RAG Client] Batch ingestion completed', {
      total: data.total,
      successful: data.successful,
      failed: data.failed,
    });

    return {
      success: data.failed === 0,
      total: data.total,
      successful: data.successful,
      failed: data.failed,
      results: data.results,
    };

  } catch (error) {
    logger.error('[RAG Client] Batch ingest failed', {
      documentCount: documents.length,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
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
      timestamp: response.data?.timestamp,
    };
  } catch (error) {
    return {
      success: false,
      status: 'unhealthy',
      error: error.message,
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
      message: response.data?.data?.message,
    };

  } catch (error) {
    logger.error('[RAG Client] Clear namespace failed', {
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
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
      text: `The Start step is the entry point for every workflow in Easy-Flow. It must be the first step and all workflows require exactly one Start step. The Start step has no configuration - it simply marks where the workflow begins execution.`,
      source: 'easyflow:help:start-step',
      metadata: { category: 'workflow_steps', step: 'start' },
    },
    {
      text: `The Web Scraping step extracts data from websites. Configure it with: URL - the webpage to scrape, CSS Selectors - to target specific elements (e.g., '.price', '#product-title'), Timeout - how long to wait (default 30s). The step uses Puppeteer for JavaScript-rendered pages.`,
      source: 'easyflow:help:web-scrape-step',
      metadata: { category: 'workflow_steps', step: 'web_scrape' },
    },
    {
      text: `The API Request step makes HTTP calls to external services. Configure: Method - GET, POST, PUT, DELETE, URL - the API endpoint, Headers - including Authorization, Body - for POST/PUT requests (JSON format). Use this for integrating with external services or webhooks.`,
      source: 'easyflow:help:api-step',
      metadata: { category: 'workflow_steps', step: 'api_call' },
    },
    {
      text: `The Send Email step sends email notifications via SendGrid. Configure: To - recipient email(s), Subject - can include variables like {{data.field}}, Template - email body supports HTML and variables. Variables from previous steps are available using {{stepName.field}} syntax.`,
      source: 'easyflow:help:email-step',
      metadata: { category: 'workflow_steps', step: 'email' },
    },
    {
      text: `The Transform Data step processes and transforms data between steps. Supports field mapping (rename/restructure), filters (include/exclude based on conditions), aggregations (count, sum, average), and format conversion (JSON to CSV). Use JavaScript expressions for complex transformations.`,
      source: 'easyflow:help:transform-step',
      metadata: { category: 'workflow_steps', step: 'data_transform' },
    },
    {
      text: `The Condition step branches workflow execution based on conditions. Configure conditions using field path, operator (equals, contains, greater than), and value. Multiple conditions can be combined with AND/OR. Has two outputs: 'true' branch and 'false' branch.`,
      source: 'easyflow:help:condition-step',
      metadata: { category: 'workflow_steps', step: 'condition' },
    },
    {
      text: `The Delay step pauses workflow execution for a specified duration. Configure duration in seconds (1-300). Use for rate limiting between API calls, waiting for external processes, or spacing out emails to avoid spam filters.`,
      source: 'easyflow:help:delay-step',
      metadata: { category: 'workflow_steps', step: 'delay' },
    },
    {
      text: `The End step marks workflow completion. Configure success/failure status and completion message. A workflow can have multiple End steps for different outcomes. When reached, the workflow completes and final status is recorded.`,
      source: 'easyflow:help:end-step',
      metadata: { category: 'workflow_steps', step: 'end' },
    },

    // App Features
    {
      text: `The Workflow Builder is a visual drag-and-drop canvas for creating automations. Drag steps from the Actions toolbar on the left, connect steps by dragging handles, click steps to configure in the side panel. Auto-save keeps your work safe. Keyboard shortcuts: Delete to remove, Ctrl+S to save.`,
      source: 'easyflow:help:workflow-builder',
      metadata: { category: 'app_features' },
    },
    {
      text: `Workflows can be scheduled to run automatically. Access via the Schedules tab. Options: One-time (specific datetime), Recurring (daily, weekly, monthly, or cron expression), with timezone support. Scheduled workflows run in the background.`,
      source: 'easyflow:help:scheduling',
      metadata: { category: 'app_features' },
    },
    {
      text: `Templates are pre-built workflows for common use cases. Access via Templates button. Categories: Web Scraping, Email Automation, Data Processing, Monitoring. Click 'Use Template' to create your own copy that you can customize.`,
      source: 'easyflow:help:templates',
      metadata: { category: 'app_features' },
    },

    // Troubleshooting
    {
      text: `If your workflow won't run, check: Is the workflow Active? (click Activate if Draft), Does it have a Start step?, Are all steps connected?, Is it saved? Check plan limits if you've hit your monthly runs. Look at the error message for specific guidance.`,
      source: 'easyflow:help:troubleshooting-not-running',
      metadata: { category: 'troubleshooting' },
    },
    {
      text: `Web scraping issues: Timeout - increase timeout or check if site is blocking, Empty results - verify CSS selectors on the actual page, Blocked - some sites block scrapers try adding delays, JavaScript content - page may need time to load add wait time, Login required - use API step instead.`,
      source: 'easyflow:help:troubleshooting-scraping',
      metadata: { category: 'troubleshooting' },
    },
    {
      text: `Email issues: Check recipient address is valid, Check spam folder, Verify your plan has email sends remaining, Template errors - make sure {{variables}} match actual data fields, Large attachments - keep under 10MB. Delivery can take 1-5 minutes.`,
      source: 'easyflow:help:troubleshooting-email',
      metadata: { category: 'troubleshooting' },
    },

    // FAQ
    {
      text: `Workflow limits by plan: Hobbyist - 0 workflows (tasks only), Starter - 3 active workflows, Professional - 10 workflows, Business - 50 workflows, Enterprise - unlimited. Archived workflows don't count toward limits.`,
      source: 'easyflow:help:faq-limits',
      metadata: { category: 'faq' },
    },
    {
      text: `Execution limits by plan: Hobbyist - 50 runs/month, Starter - 500 runs/month, Professional - 2000 runs/month, Business - 10000 runs/month, Enterprise - unlimited. Each workflow execution counts as one run.`,
      source: 'easyflow:help:faq-runs',
      metadata: { category: 'faq' },
    },
    {
      text: `Easy-Flow security: All data encrypted in transit (HTTPS/TLS) and at rest, API keys stored securely never exposed to browser, Row-level security ensures data isolation, No workflow data shared between users, SOC2 compliance in progress.`,
      source: 'easyflow:help:faq-security',
      metadata: { category: 'faq' },
    },
  ];

  logger.info('[RAG Client] Seeding Easy-Flow knowledge...', {
    documentCount: knowledge.length,
  });

  const result = await ingestBatch(knowledge);

  logger.info('[RAG Client] Knowledge seeding complete', {
    successful: result.successful,
    failed: result.failed,
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
  RAG_SERVICE_URL,
};

