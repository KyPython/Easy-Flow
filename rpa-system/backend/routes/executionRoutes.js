
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const requireFeature = require('../middleware/planEnforcement');
const { LinkDiscoveryService } = require('../services/linkDiscoveryService');
const { createContextLogger } = require('../middleware/traceContext');

const router = express.Router();

// Get execution details with step_executions
router.get('/:executionId', requireFeature('workflow_executions'), async (req, res) => {
  // ✅ Create context-aware logger with business attributes
  const logger = createContextLogger({
    userId: req.user?.id,
    executionId: req.params.executionId,
    operation: 'get_execution_details'
  });
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('Authentication required for execution details');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { executionId } = req.params;
    logger.info('Fetching execution details', { executionId });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select(`*, step_executions(*)`)
      .eq('id', executionId)
      .single();

    if (error || !execution) {
      logger.warn('Execution not found', { executionId, error: error?.message });
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    if (execution.user_id !== userId) {
      logger.warn('Access denied - execution belongs to different user', { 
        executionId, 
        executionUserId: execution.user_id,
        requestUserId: userId 
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    logger.info('Execution details retrieved successfully', { 
      executionId,
      stepCount: execution.step_executions?.length || 0,
      status: execution.status
    });

    return res.json({ execution });
  } catch (e) {
    logger.error('Failed to fetch execution details', e, {
      executionId: req.params.executionId,
      operation: 'get_execution_details'
    });
    return res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// Get execution step logs
router.get('/:executionId/steps', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { executionId } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // Verify ownership via execution
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select('id,user_id')
      .eq('id', executionId)
      .single();
    if (execError || !execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const { data: steps, error } = await supabase
      .from('step_executions')
      .select(`*`)
      .eq('workflow_execution_id', executionId)
      .order('execution_order', { ascending: true });
    if (error) throw error;

    return res.json({ steps: steps || [] });
  } catch (e) {
    console.error('[ExecutionRoutes] Get steps error:', e);
    return res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

// Cancel a running execution
router.post('/:executionId/cancel', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { executionId } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // Verify execution exists and belongs to user
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select('id, user_id, status')
      .eq('id', executionId)
      .single();

    if (execError || !execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (execution.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (execution.status !== 'running') {
      return res.status(400).json({ error: `Cannot cancel execution in status: ${execution.status}` });
    }

    // Mark as cancelled
    const { error: updateError } = await supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Execution cancelled by user'
      })
      .eq('id', executionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[ExecutionRoutes] Cancel error:', error);
    return res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

// Test link discovery for Invoice Download tasks
router.post('/test-link-discovery', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { 
      url, 
      username, 
      password, 
      discoveryMethod = 'auto-detect', 
      discoveryValue 
    } = req.body;

    // Validate required fields
    if (!url || !username || !password) {
      return res.status(400).json({
        error: 'Missing required fields: url, username, password'
      });
    }

    // Validate discovery method specific requirements
    if (discoveryMethod === 'css-selector' && !discoveryValue) {
      return res.status(400).json({
        error: 'CSS Selector is required when using css-selector method'
      });
    }

    if (discoveryMethod === 'text-match' && !discoveryValue) {
      return res.status(400).json({
        error: 'Link Text is required when using text-match method'
      });
    }

    console.log(`[TestLinkDiscovery] Starting test for user ${userId}:`, {
      url, username: username.substring(0, 3) + '***', discoveryMethod
    });

    const linkDiscovery = new LinkDiscoveryService();
    
    // Run discovery in test mode
    const discoveryResult = await linkDiscovery.discoverPdfLinks({
      url,
      username,
      password,
      discoveryMethod,
      discoveryValue,
      testMode: true
    });

    console.log(`[TestLinkDiscovery] Discovery completed:`, {
      success: discoveryResult.success,
      linksFound: discoveryResult.discoveredLinks?.length || 0
    });

    return res.json({
      success: true,
      discoveryResult
    });

  } catch (error) {
    console.error('[TestLinkDiscovery] Error:', error);
    return res.status(500).json({
      error: 'Link discovery test failed',
      details: error.message
    });
  }
});

module.exports = router;
