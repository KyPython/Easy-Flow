const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { traceContextMiddleware } = require('../middleware/traceContext');
const decisionLogService = require('../services/decisionLogService');
const { getSupabase } = require('../utils/supabaseClient');
const rateLimit = require('express-rate-limit');

const logger = createLogger('routes.decisionLogs');

// Rate limiting - Environment-aware
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment || isTest ? 5000 : 100, // Much higher in dev/test
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: () => isDevelopment || isTest // Skip entirely in dev/test
});

// Auth middleware with dev bypass support
const { checkDevBypass } = require('../middleware/devBypassAuth');
const authMiddleware = async (req, res, next) => {
  try {
    // ✅ SECURITY: Check dev bypass first (only works in development)
    const devUser = checkDevBypass(req);
    if (devUser) {
      req.user = devUser;
      req.userId = devUser.id;
      req.devBypass = true;
      req.devUser = { id: devUser.id, isDevBypass: true };
      return next();
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const authHeader = (req.get('authorization') || '').trim();
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    req.user = data.user;
    req.userId = data.user.id;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', { error: error.message });
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * GET /api/decision-logs/:executionId
 * Get decision logs for a workflow execution
 */
router.get('/:executionId', authMiddleware, apiLimiter, traceContextMiddleware, async (req, res) => {
  try {
    const { executionId } = req.params;
    const userId = req.userId;

    const logs = await decisionLogService.getExecutionDecisionLogs(executionId, userId);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    logger.error('[GET /api/decision-logs/:executionId] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch decision logs',
      details: error.message
    });
  }
});

/**
 * GET /api/decision-logs/step/:stepId
 * Get decision logs for a specific step execution
 */
router.get('/step/:stepId', authMiddleware, apiLimiter, traceContextMiddleware, async (req, res) => {
  try {
    const { stepId } = req.params;
    const userId = req.userId;

    const logs = await decisionLogService.getStepDecisionLogs(stepId, userId);

    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    logger.error('[GET /api/decision-logs/step/:stepId] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch step decision logs',
      details: error.message
    });
  }
});

module.exports = router;

