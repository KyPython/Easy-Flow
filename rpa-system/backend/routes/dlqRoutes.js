/**
 * DLQ (Dead Letter Queue) Routes
 * API endpoints for inspecting and managing failed workflow executions
 * 
 * Endpoints:
 * - GET /api/dlq - List failed jobs
 * - GET /api/dlq/:jobId - Get job details
 * - POST /api/dlq/:jobId/replay - Replay single job
 * - POST /api/dlq/replay-bulk - Bulk replay jobs
 * - GET /api/dlq/stats - Get DLQ statistics
 * - GET /api/dlq/categories - Get error categories
 */

const express = require('express');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');
const { DLQService } = require('../services/dlqService');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/dlq
 * List failed jobs in the Dead Letter Queue
 */
router.get('/', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 50, offset = 0, workflowId, category } = req.query;

    const dlq = new DLQService();
    const result = await dlq.getFailedJobs({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      workflowId,
      category,
      userId
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to list DLQ jobs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch DLQ jobs' });
  }
});

/**
 * GET /api/dlq/stats
 * Get DLQ statistics for monitoring
 */
router.get('/stats', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workflowId } = req.query;

    const dlq = new DLQService();
    const stats = await dlq.getDLQStats(userId, workflowId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to get DLQ stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch DLQ statistics' });
  }
});

/**
 * GET /api/dlq/categories
 * Get list of error categories for filtering
 */
router.get('/categories', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dlq = new DLQService();
    const categories = await dlq.getErrorCategories(userId);

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to get error categories', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch error categories' });
  }
});

/**
 * GET /api/dlq/:jobId
 * Get detailed information about a failed job
 */
router.get('/:jobId', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { jobId } = req.params;

    const dlq = new DLQService();
    const job = await dlq.getFailedJobDetails(jobId, userId);

    res.json({
      success: true,
      job
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to get job details', {
      jobId: req.params.jobId,
      error: error.message
    });

    if (error.message === 'Failed job not found') {
      return res.status(404).json({ error: 'Job not found in DLQ' });
    }

    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

/**
 * POST /api/dlq/:jobId/replay
 * Replay a single failed job from the DLQ
 */
router.post('/:jobId/replay', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { jobId } = req.params;
    const { newInputData } = req.body;

    const dlq = new DLQService();
    const newExecution = await dlq.replayFailedJob(jobId, userId, newInputData || {});

    logger.info('[DLQRoutes] Successfully replayed job from DLQ', {
      original_job_id: jobId,
      new_execution_id: newExecution.id,
      user_id: userId
    });

    res.json({
      success: true,
      message: 'Job replayed successfully',
      original_job_id: jobId,
      new_execution_id: newExecution.id
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to replay job', {
      jobId: req.params.jobId,
      error: error.message
    });

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to replay job' });
  }
});

/**
 * POST /api/dlq/replay-bulk
 * Replay multiple failed jobs from the DLQ
 */
router.post('/replay-bulk', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { jobIds, newInputData } = req.body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'jobIds array is required' });
    }

    if (jobIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 jobs per bulk replay' });
    }

    const dlq = new DLQService();
    const results = await dlq.bulkReplay(jobIds, userId, { newInputData });

    logger.info('[DLQRoutes] Bulk replay completed', {
      successful: results.successful,
      failed: results.failed,
      user_id: userId
    });

    res.json({
      success: true,
      ...results,
      message: `Replayed ${results.successful}/${jobIds.length} jobs successfully`
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to bulk replay jobs', { error: error.message });
    res.status(500).json({ error: 'Failed to bulk replay jobs' });
  }
});

/**
 * POST /api/dlq/archive
 * Archive old DLQ entries (for cleanup)
 */
router.post('/archive', requireFeature('workflow_executions'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only allow admin users to archive
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { olderThanDays = 30 } = req.body;

    const dlq = new DLQService();
    const result = await dlq.archiveOldEntries(userId, olderThanDays);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('[DLQRoutes] Failed to archive DLQ entries', { error: error.message });
    res.status(500).json({ error: 'Failed to archive DLQ entries' });
  }
});

module.exports = router;
