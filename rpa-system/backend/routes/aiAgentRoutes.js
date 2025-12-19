/**
 * AI Workflow Agent API Routes
 * 
 * Endpoints for the natural language workflow generation system.
 * 
 * OBSERVABILITY:
 * - All routes use structured logging with request context
 * - Performance metrics tracked for each endpoint
 * - Security events logged for rate limiting
 */

const express = require('express');
const router = express.Router();
const aiAgent = require('../services/aiWorkflowAgent');
const { createLogger } = require('../middleware/structuredLogging');
const { traceContextMiddleware } = require('../middleware/traceContext');
const rateLimit = require('express-rate-limit');

// Namespaced logger for AI routes
const logger = createLogger('ai.routes');

// Context logger middleware (same as traceContext)
const contextLoggerMiddleware = traceContextMiddleware;

// API rate limiter for authenticated endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute for API endpoints
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// Authentication middleware - validates JWT token
const authMiddleware = async (req, res, next) => {
  try {
    // Test bypass for development
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_TOKEN) {
      const authHeader = (req.get('authorization') || '').trim();
      const token = authHeader.split(' ')[1];
      if (token === process.env.DEV_BYPASS_TOKEN) {
        req.user = {
          id: process.env.DEV_USER_ID || 'dev-user-123',
          email: 'developer@localhost'
        };
        return next();
      }
    }

    // For routes mounted after the global auth middleware, user should already be set
    // This is a fallback check
    if (!req.user || !req.user.id) {
      logger.warn('Auth middleware: no user found', { path: req.path });
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error', error, { path: req.path });
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// Local rate limiting for AI chat requests (in addition to express-rate-limit)
const localRateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = localRateLimitStore.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  userLimit.count++;
  localRateLimitStore.set(userId, userLimit);
  
  const allowed = userLimit.count <= RATE_LIMIT_MAX;
  
  // Log rate limit events
  if (!allowed) {
    logger.security('ai.rate_limit_exceeded', 'blocked', {
      userId,
      count: userLimit.count,
      limit: RATE_LIMIT_MAX,
      resetTime: new Date(userLimit.resetTime).toISOString()
    });
  }
  
  return allowed;
}

/**
 * POST /api/ai-agent/message
 * Main endpoint for AI agent interactions
 * 
 * NOW WITH FULL APP CONTROL:
 * The AI can now execute actions like scraping, emailing, API calls,
 * task management, workflow creation, and more - all via natural language!
 * 
 * OBSERVABILITY: Full request logging with performance tracking
 */
router.post('/message', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please sign in to use the AI assistant.'
    });
  }
  const userEmail = req.user?.email;
  
  // Create request-scoped logger
  const reqLogger = logger
    .withUser({ id: userId, email: userEmail })
    .withOperation('ai.route.message', { requestId: req.requestId });

  try {
    // Check rate limit
    if (!checkRateLimit(userId)) {
      reqLogger.warn('Rate limit exceeded for AI message');
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: 60
      });
    }

    const { message, context = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long. Please keep it under 2000 characters.'
      });
    }

    reqLogger.info('Processing AI message', { 
      messageLength: message.length,
      hasContext: !!context.previousMessages 
    });

    // Enrich context with user information for action execution
    const enrichedContext = {
      ...context,
      userId,
      userEmail,
      timezone: req.headers['x-timezone'] || context.timezone || 'UTC'
    };

    const result = await aiAgent.handleMessage(message, enrichedContext);
    const duration = Date.now() - startTime;

    // Log performance metric
    reqLogger.performance('ai.route.message', duration, {
      category: 'api_endpoint',
      resultType: result.type,
      success: result.success
    });

    // Log action executions
    if (result.type === 'action') {
      reqLogger.info('AI action executed via message endpoint', {
        action: result.action,
        success: result.success,
        duration
      });
      
      reqLogger.metric('ai.route.action_executed', 1, 'count', {
        action: result.action,
        success: result.success
      });
    }

    res.json(result);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    reqLogger.error('Error processing AI message', error, {
      duration
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to process your request',
      message: "I'm having trouble right now. Please try again!"
    });
  }
});

/**
 * POST /api/ai-agent/generate-workflow
 * Dedicated endpoint for workflow generation
 */
router.post('/generate-workflow', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please sign in to generate workflows.'
      });
    }
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait before generating another workflow.'
      });
    }

    const { description, context = {} } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Workflow description is required and must be a string'
      });
    }

    logger.info('[AI Agent Route] Generating workflow', { userId, description: String(description).slice(0, 100) });

    const result = await aiAgent.parseNaturalLanguage(description, context);

    if (result.success && result.workflow) {
      // Track usage
      logger.info('[AI Agent Route] Workflow generated successfully', {
        userId,
        nodeCount: result.workflow.nodes?.length,
        edgeCount: result.workflow.edges?.length
      });
    }

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error generating workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate workflow',
      suggestion: 'Try being more specific about what you want to automate.'
    });
  }
});

/**
 * POST /api/ai-agent/refine-workflow
 * Refine an existing workflow based on user feedback
 */
router.post('/refine-workflow', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please sign in to refine workflows.'
      });
    }
    
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded.'
      });
    }

    const { workflow, refinement, context = {} } = req.body;

    if (!workflow || !refinement || typeof refinement !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Both workflow object and refinement string are required'
      });
    }

    logger.info('[AI Agent Route] Refining workflow', { userId, refinement: String(refinement).slice(0, 100) });

    const result = await aiAgent.refineWorkflow(workflow, refinement, context);

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error refining workflow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refine workflow'
    });
  }
});

/**
 * GET /api/ai-agent/suggestions
 * Get smart suggestions based on partial input
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    const suggestions = await aiAgent.getSuggestions(q || '');
    
    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.error('[AI Agent Route] Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      suggestions: []
    });
  }
});

/**
 * GET /api/ai-agent/capabilities
 * Return available workflow step types and their configurations
 */
router.get('/capabilities', (req, res) => {
  res.json({
    success: true,
    steps: aiAgent.WORKFLOW_STEPS,
    examples: [
      {
        title: '📊 Data Collection',
        description: 'Scrape product prices from websites daily',
        prompt: 'Create a workflow that scrapes product prices from amazon.com every day at 9 AM and saves them to a spreadsheet'
      },
      {
        title: '📧 Email Automation',
        description: 'Send automated reports and notifications',
        prompt: 'Build a workflow that sends me a daily email summary of all completed tasks'
      },
      {
        title: '🔗 API Integration',
        description: 'Connect different services together',
        prompt: 'Make a workflow that gets data from one API and posts it to another'
      },
      {
        title: '⏰ Scheduled Tasks',
        description: 'Run automations on a schedule',
        prompt: 'Create a workflow that checks website uptime every hour and alerts me if it\'s down'
      },
      {
        title: '🔄 Data Processing',
        description: 'Transform and process data automatically',
        prompt: 'Build a workflow that transforms CSV data and uploads it to cloud storage'
      }
    ]
  });
});

/**
 * GET /api/ai-agent/health
 * Health check for the AI agent service
 */
router.get('/health', async (req, res) => {
  try {
    // Check if OpenAI API key is configured
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    
    res.json({
      status: hasApiKey ? 'healthy' : 'degraded',
      aiEnabled: hasApiKey,
      message: hasApiKey 
        ? 'AI Workflow Agent is ready' 
        : 'OpenAI API key not configured. AI features are limited.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ============================================
// CONVERSATION PERSISTENCE
// ============================================

const { getSupabase } = require('../utils/supabaseClient');

/**
 * GET /api/ai-agent/conversations
 * Get the user's recent conversation history
 */
router.get('/conversations', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    const supabase = getSupabase();
    if (!supabase) {
      // Return empty if no database
      return res.json({ success: true, messages: [] });
    }

    // Get recent messages for this user (last 50)
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      logger.warn('Failed to fetch conversations', { error: error.message, userId });
      return res.json({ success: true, messages: [] });
    }

    // Transform to frontend format
    const messages = (data || []).map(row => ({
      id: row.id,
      content: row.content,
      isUser: row.is_user,
      timestamp: row.created_at,
      workflow: row.workflow_data,
      suggestions: row.suggestions
    }));

    res.json({ success: true, messages });
  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.json({ success: true, messages: [] });
  }
});

/**
 * POST /api/ai-agent/conversations
 * Save a message to the conversation history
 */
router.post('/conversations', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    const { content, isUser, workflow, suggestions } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      // Silently succeed if no database
      return res.json({ success: true });
    }

    const { error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userId,
        content: content.slice(0, 10000), // Limit content size
        is_user: !!isUser,
        workflow_data: workflow || null,
        suggestions: suggestions || null
      });

    if (error) {
      logger.warn('Failed to save conversation', { error: error.message, userId });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error saving conversation', error);
    res.json({ success: true }); // Don't fail the request
  }
});

/**
 * DELETE /api/ai-agent/conversations
 * Clear the user's conversation history
 */
router.delete('/conversations', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    const supabase = getSupabase();
    if (!supabase) {
      return res.json({ success: true });
    }

    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.warn('Failed to clear conversations', { error: error.message, userId });
    }

    res.json({ success: true, message: 'Conversation history cleared' });
  } catch (error) {
    logger.error('Error clearing conversations', error);
    res.json({ success: true });
  }
});

/**
 * POST /api/ai-agent/send-support-email
 * Send a support email on behalf of the user
 */
router.post('/send-support-email', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please sign in to send support emails.'
      });
    }
    const { subject, body } = req.body;

    if (!subject || typeof subject !== 'string' || !body || typeof body !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Subject and body are required strings'
      });
    }

    // Get SendGrid if available
    const sgMail = require('@sendgrid/mail');
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@useeasyflow.com';
    const fromEmail = process.env.FROM_EMAIL || 'noreply@useeasyflow.com';

    if (!sendgridKey) {
      logger.warn('[AI Agent Route] SendGrid not configured, support email not sent');
      return res.status(503).json({
        success: false,
        error: 'Email service not configured',
        fallback: 'mailto'
      });
    }

    sgMail.setApiKey(sendgridKey);

    const msg = {
      to: supportEmail,
      from: fromEmail,
      replyTo: userEmail || fromEmail,
      subject: `[Easy-Flow Support] ${String(subject).slice(0, 100)}`,
      text: `Support request from user: ${userId || 'Anonymous'}\nEmail: ${userEmail || 'Not provided'}\n\n${body}`,
      html: `
        <h2>Support Request</h2>
        <p><strong>User ID:</strong> ${userId || 'Anonymous'}</p>
        <p><strong>User Email:</strong> ${userEmail || 'Not provided'}</p>
        <hr/>
        <p>${body.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p><small>Sent via AI Assistant at ${new Date().toISOString()}</small></p>
      `
    };

    await sgMail.send(msg);

    logger.info('[AI Agent Route] Support email sent', { 
      userId, 
      subject: String(subject).slice(0, 50) 
    });

    res.json({
      success: true,
      message: 'Support email sent successfully'
    });

  } catch (error) {
    logger.error('[AI Agent Route] Error sending support email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send support email',
      fallback: 'mailto'
    });
  }
});

/**
 * POST /api/ai-agent/feedback
 * Submit feedback on AI responses - this helps the AI learn!
 */
router.post('/feedback', authMiddleware, contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const { userQuery, aiResponse, wasHelpful, feedback } = req.body;

    if (!userQuery || typeof userQuery !== 'string' || typeof wasHelpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'userQuery (string) and wasHelpful (boolean) are required'
      });
    }

    const result = await aiAgent.learnFromFeedback(
      userQuery,
      aiResponse || '',
      wasHelpful,
      feedback || ''
    );

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error processing feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback'
    });
  }
});

/**
 * POST /api/ai-agent/initialize-knowledge
 * Initialize/seed the AI knowledge base (admin only)
 */
router.post('/initialize-knowledge', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    // This should probably be admin-only in production
    const result = await aiAgent.initializeKnowledge();
    res.json(result);
  } catch (error) {
    logger.error('[AI Agent Route] Error initializing knowledge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize knowledge base'
    });
  }
});

/**
 * GET /api/ai-agent/knowledge-status
 * Check the status of the AI knowledge base
 */
router.get('/knowledge-status', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const { getSupabase } = require('../utils/supabase');
    const supabase = getSupabase();

    const { count, error } = await supabase
      .from('ai_knowledge_base')
      .select('*', { count: 'exact', head: true });

    if (error && error.code === '42P01') {
      return res.json({
        success: true,
        status: 'not_initialized',
        message: 'Knowledge base table does not exist. Run the migration first.',
        knowledgeCount: 0
      });
    }

    res.json({
      success: true,
      status: 'ready',
      knowledgeCount: count || 0
    });

  } catch (error) {
    logger.error('[AI Agent Route] Error checking knowledge status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check knowledge status'
    });
  }
});

// ============================================================================
// ONE-OFF AUTOMATION ENDPOINTS
// Direct action execution without going through the AI chat
// ============================================================================

const actionExecutor = require('../services/aiActionExecutor');

/**
 * GET /api/ai-agent/actions
 * List all available actions the AI can perform
 */
router.get('/actions', authMiddleware, contextLoggerMiddleware, async (req, res) => {
  try {
    const actions = actionExecutor.getAvailableActions();
    
    // Group by category
    const grouped = actions.reduce((acc, action) => {
      const category = action.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push({
        name: action.name,
        description: action.description,
        parameters: action.parameters
      });
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        categories: Object.keys(grouped),
        actions: grouped,
        totalCount: actions.length
      }
    });
  } catch (error) {
    logger.error('[AI Agent Route] Error listing actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list actions'
    });
  }
});

/**
 * POST /api/ai-agent/execute
 * Execute an action directly (without AI interpretation)
 * 
 * OBSERVABILITY: Direct action execution tracking
 */
router.post('/execute', authMiddleware, contextLoggerMiddleware, apiLimiter, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  
  const reqLogger = logger
    .withUser({ id: userId, email: userEmail })
    .withOperation('ai.route.execute', { requestId: req.requestId });

  try {
    const { action, params = {} } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Action name is required'
      });
    }

    reqLogger.info('Direct action execution requested', {
      action,
      paramKeys: Object.keys(params)
    });

    const result = await actionExecutor.executeAction(action, params, {
      userId,
      userEmail,
      timezone: req.headers['x-timezone'] || 'UTC'
    });
    
    const duration = Date.now() - startTime;

    reqLogger.performance('ai.route.execute', duration, {
      category: 'api_endpoint',
      action,
      success: result.success
    });

    reqLogger.metric('ai.direct_action.executed', 1, 'count', {
      action,
      success: result.success
    });

    res.json(result);

  } catch (error) {
    reqLogger.error('Error executing direct action', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute action'
    });
  }
});

/**
 * POST /api/ai-agent/scrape
 * Quick scrape endpoint - one-off web scraping
 */
router.post('/scrape', authMiddleware, contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { url, selectors, wait_for, timeout } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    logger.info('[AI Agent Route] Quick scrape', { userId, url });

    const result = await actionExecutor.executeAction('scrape_website', {
      url,
      selectors: selectors || [],
      wait_for,
      timeout: timeout || 30
    }, { userId });

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error in quick scrape:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scrape website'
    });
  }
});

/**
 * POST /api/ai-agent/email
 * Quick email endpoint - send one-off emails
 */
router.post('/email', authMiddleware, contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { to, subject, body, is_html } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'to, subject, and body are required'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    // ✅ SECURITY: Validate type before using string methods
    const safeSubject = typeof subject === 'string' ? subject.slice(0, 50) : String(subject || '').slice(0, 50);
    logger.info('[AI Agent Route] Quick email', { userId, to, subject: safeSubject });

    const result = await actionExecutor.executeAction('send_email', {
      to,
      subject,
      body,
      is_html: is_html || false
    }, { userId });

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error sending email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
});

/**
 * POST /api/ai-agent/api-call
 * Quick API call endpoint - make one-off HTTP requests
 */
router.post('/api-call', authMiddleware, contextLoggerMiddleware, apiLimiter, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { url, method, headers, body } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    logger.info('[AI Agent Route] Quick API call', { userId, url, method: method || 'GET' });

    const result = await actionExecutor.executeAction('make_api_call', {
      url,
      method: method || 'GET',
      headers: headers || {},
      body
    }, { userId });

    res.json(result);

  } catch (error) {
    logger.error('[AI Agent Route] Error making API call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to make API call'
    });
  }
});

module.exports = router;

