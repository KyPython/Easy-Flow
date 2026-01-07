const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { traceContextMiddleware } = require('../middleware/traceContext');
const rateLimit = require('express-rate-limit');
const businessRulesService = require('../services/businessRulesService');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');

// Auth middleware with dev bypass support
const { devBypassAuthMiddleware, checkDevBypass } = require('../middleware/devBypassAuth');
const authMiddleware = async (req, res, next) => {
  try {
    // ✅ SECURITY: Check dev bypass first (only works in development)
    const devUser = checkDevBypass(req);
    if (devUser) {
      req.user = devUser;
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
    next();
  } catch (error) {
    logger.error('Auth middleware error:', { error: error.message });
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const logger = createLogger('routes.businessRules');
const contextLoggerMiddleware = traceContextMiddleware;

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment || isTest ? 5000 : 30, // Much higher in dev/test
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: () => isDevelopment || isTest // Skip entirely in dev/test
});

/**
 * GET /api/business-rules
 * Get all rules for the authenticated user
 * Requires: business_rules feature (Starter+)
 */
router.get('/', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const rules = await businessRulesService.getUserRules(userId);

    logger.info('Fetched user rules', { userId, count: rules.length });
    res.json({ success: true, data: rules });
  } catch (error) {
    logger.error('Error fetching rules:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rules',
      details: error.message
    });
  }
});

/**
 * GET /api/business-rules/:ruleId
 * Get a single rule by ID
 * Requires: business_rules feature (Starter+)
 */
router.get('/:ruleId', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.id;

    const rule = await businessRulesService.getRuleById(ruleId, userId);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Get usage information
    const usage = await businessRulesService.getRuleUsage(ruleId, userId);

    res.json({
      success: true,
      data: {
        ...rule,
        usage: {
          workflows: usage,
          count: usage.length
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching rule:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rule',
      details: error.message
    });
  }
});

/**
 * POST /api/business-rules
 * Create a new rule
 * Requires: business_rules feature (Starter+)
 */
router.post('/', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ruleData = req.body;

    // Validate required fields
    if (!ruleData.name || !ruleData.description) {
      return res.status(400).json({
        success: false,
        error: 'Rule name and description are required'
      });
    }

    const rule = await businessRulesService.createRule(ruleData, userId);

    logger.info('Created business rule', { ruleId: rule.id, userId });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating rule:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Failed to create rule',
      details: error.message
    });
  }
});

/**
 * PUT /api/business-rules/:ruleId
 * Update an existing rule
 * Requires: business_rules feature (Starter+)
 */
router.put('/:ruleId', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.id;
    const ruleData = req.body;

    const rule = await businessRulesService.updateRule(ruleId, ruleData, userId);

    logger.info('Updated business rule', { ruleId, userId });
    res.json({ success: true, data: rule });
  } catch (error) {
    if (error.message === 'Rule not found or access denied') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    logger.error('Error updating rule:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to update rule',
      details: error.message
    });
  }
});

/**
 * DELETE /api/business-rules/:ruleId
 * Delete a rule
 * Requires: business_rules feature (Starter+)
 */
router.delete('/:ruleId', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.id;

    await businessRulesService.deleteRule(ruleId, userId);

    logger.info('Deleted business rule', { ruleId, userId });
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    if (error.message === 'Rule not found or access denied') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    logger.error('Error deleting rule:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to delete rule',
      details: error.message
    });
  }
});

/**
 * GET /api/business-rules/:ruleId/usage
 * Get workflows that use this rule
 * Requires: business_rules feature (Starter+)
 */
router.get('/:ruleId/usage', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.id;

    const usage = await businessRulesService.getRuleUsage(ruleId, userId);

    res.json({
      success: true,
      data: {
        ruleId,
        workflows: usage,
        count: usage.length
      }
    });
  } catch (error) {
    logger.error('Error fetching rule usage:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rule usage',
      details: error.message
    });
  }
});

/**
 * POST /api/business-rules/:ruleId/evaluate
 * Evaluate a rule against provided data (for testing)
 * Requires: business_rules feature (Starter+)
 */
router.post('/:ruleId/evaluate', authMiddleware, requireFeature('business_rules'), apiLimiter, contextLoggerMiddleware, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user.id;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required for rule evaluation'
      });
    }

    const result = await businessRulesService.evaluateRule(ruleId, data, userId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error evaluating rule:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate rule',
      details: error.message
    });
  }
});

module.exports = router;

