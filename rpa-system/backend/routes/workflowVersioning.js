/**
 * Workflow Versioning API Routes
 * 
 * Endpoints for managing workflow versions, comparisons, and rollbacks
 */

const express = require('express');
const { workflowVersioningService } = require('../services/workflowVersioningService');
const { auditLogger } = require('../utils/auditLogger');
const router = express.Router();

/**
 * POST /api/workflows/:workflowId/versions
 * Create a new version of a workflow
 */
router.post('/:workflowId/versions', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { changeComment, changeType = 'manual' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newVersion = await workflowVersioningService.createVersion(
      workflowId,
      userId,
      changeComment,
      changeType
    );

    if (!newVersion) {
      return res.json({
        success: true,
        message: 'No changes detected, version not created',
        data: null
      });
    }

    res.json({
      success: true,
      message: `Version ${newVersion.version_number} created successfully`,
      data: newVersion
    });
  } catch (error) {
    console.error('Failed to create workflow version:', error);
    res.status(500).json({
      error: 'Failed to create workflow version',
      details: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflowId/versions
 * Get all versions for a workflow
 */
router.get('/:workflowId/versions', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { 
      limit = 20, 
      offset = 0, 
      includeContent = false 
    } = req.query;

    const result = await workflowVersioningService.getWorkflowVersions(workflowId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeContent: includeContent === 'true'
    });

    await auditLogger.logUserAction(
      req.user.id,
      'view_workflow_versions',
      { 
        workflow_id: workflowId,
        versions_count: result.versions.length
      },
      req
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to get workflow versions:', error);
    res.status(500).json({
      error: 'Failed to get workflow versions',
      details: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflowId/versions/:versionNumber
 * Get a specific version of a workflow
 */
router.get('/:workflowId/versions/:versionNumber', async (req, res) => {
  try {
    const { workflowId, versionNumber } = req.params;

    const version = await workflowVersioningService.getVersion(
      workflowId,
      parseInt(versionNumber)
    );

    if (!version) {
      return res.status(404).json({
        error: 'Version not found'
      });
    }

    await auditLogger.logUserAction(
      req.user.id,
      'view_workflow_version',
      { 
        workflow_id: workflowId,
        version_number: parseInt(versionNumber)
      },
      req
    );

    res.json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('Failed to get workflow version:', error);
    res.status(500).json({
      error: 'Failed to get workflow version',
      details: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflowId/versions/:fromVersion/compare/:toVersion
 * Compare two versions of a workflow
 */
router.get('/:workflowId/versions/:fromVersion/compare/:toVersion', async (req, res) => {
  try {
    const { workflowId, fromVersion, toVersion } = req.params;

    const comparison = await workflowVersioningService.compareVersions(
      workflowId,
      parseInt(fromVersion),
      parseInt(toVersion)
    );

    await auditLogger.logUserAction(
      req.user.id,
      'compare_workflow_versions',
      { 
        workflow_id: workflowId,
        from_version: parseInt(fromVersion),
        to_version: parseInt(toVersion)
      },
      req
    );

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Failed to compare workflow versions:', error);
    res.status(500).json({
      error: 'Failed to compare workflow versions',
      details: error.message
    });
  }
});

/**
 * POST /api/workflows/:workflowId/versions/:versionNumber/rollback
 * Rollback workflow to a specific version
 */
router.post('/:workflowId/versions/:versionNumber/rollback', async (req, res) => {
  try {
    const { workflowId, versionNumber } = req.params;
    const { rollbackComment } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await workflowVersioningService.rollbackToVersion(
      workflowId,
      parseInt(versionNumber),
      userId,
      rollbackComment
    );

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Failed to rollback workflow version:', error);
    res.status(500).json({
      error: 'Failed to rollback workflow version',
      details: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflowId/versions/statistics
 * Get version history statistics
 */
router.get('/:workflowId/versions/statistics', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const stats = await workflowVersioningService.getVersionStatistics(workflowId);

    await auditLogger.logUserAction(
      req.user.id,
      'view_version_statistics',
      { 
        workflow_id: workflowId,
        total_versions: stats.total_versions
      },
      req
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get version statistics:', error);
    res.status(500).json({
      error: 'Failed to get version statistics',
      details: error.message
    });
  }
});

/**
 * POST /api/workflows/:workflowId/versions/:versionNumber/export
 * Export a workflow version
 */
router.post('/:workflowId/versions/:versionNumber/export', async (req, res) => {
  try {
    const { workflowId, versionNumber } = req.params;

    const exportData = await workflowVersioningService.exportVersion(
      workflowId,
      parseInt(versionNumber)
    );

    await auditLogger.logUserAction(
      req.user.id,
      'export_workflow_version',
      { 
        workflow_id: workflowId,
        version_number: parseInt(versionNumber)
      },
      req
    );

    // Set headers for file download
    const filename = `workflow-${workflowId}-v${versionNumber}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');

    res.json(exportData);
  } catch (error) {
    console.error('Failed to export workflow version:', error);
    res.status(500).json({
      error: 'Failed to export workflow version',
      details: error.message
    });
  }
});

/**
 * POST /api/workflows/:workflowId/versions/auto
 * Auto-create version when workflow is modified
 */
router.post('/:workflowId/versions/auto', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { changeContext } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const newVersion = await workflowVersioningService.autoVersion(
      workflowId,
      userId,
      changeContext
    );

    res.json({
      success: true,
      message: newVersion ? 
        `Auto-version ${newVersion.version_number} created` : 
        'No changes detected, auto-version not created',
      data: newVersion
    });
  } catch (error) {
    console.error('Failed to create auto-version:', error);
    // Don't return error for auto-versioning failures
    res.json({
      success: false,
      message: 'Auto-versioning failed but workflow operation continued',
      data: null
    });
  }
});

/**
 * DELETE /api/workflows/:workflowId/versions/cleanup
 * Clean up old versions based on retention policy
 */
router.delete('/:workflowId/versions/cleanup', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { 
      keepLast = 50, 
      keepDays = 365 
    } = req.body;

    const result = await workflowVersioningService.cleanupOldVersions(workflowId, {
      keepLast: parseInt(keepLast),
      keepDays: parseInt(keepDays)
    });

    await auditLogger.logUserAction(
      req.user.id,
      'cleanup_workflow_versions',
      { 
        workflow_id: workflowId,
        versions_cleaned: result.cleaned,
        versions_kept: result.kept
      },
      req
    );

    res.json({
      success: true,
      message: `Cleaned up ${result.cleaned} old versions, kept ${result.kept} versions`,
      data: result
    });
  } catch (error) {
    console.error('Failed to cleanup workflow versions:', error);
    res.status(500).json({
      error: 'Failed to cleanup workflow versions',
      details: error.message
    });
  }
});

/**
 * GET /api/workflows/:workflowId/versions/:versionNumber/preview
 * Preview what would change if rolling back to a specific version
 */
router.get('/:workflowId/versions/:versionNumber/preview', async (req, res) => {
  try {
    const { workflowId, versionNumber } = req.params;

    // Get current version (latest)
    const { data: versions } = await workflowVersioningService.getWorkflowVersions(workflowId, {
      limit: 1,
      includeContent: true
    });

    if (!versions || versions.length === 0) {
      return res.status(404).json({ error: 'No versions found' });
    }

    const currentVersion = versions[0];
    
    // Compare target version with current
    const comparison = await workflowVersioningService.compareVersions(
      workflowId,
      currentVersion.version_number,
      parseInt(versionNumber)
    );

    await auditLogger.logUserAction(
      req.user.id,
      'preview_rollback',
      { 
        workflow_id: workflowId,
        current_version: currentVersion.version_number,
        target_version: parseInt(versionNumber)
      },
      req
    );

    res.json({
      success: true,
      data: {
        current_version: currentVersion.version_number,
        target_version: parseInt(versionNumber),
        preview: comparison,
        warning: 'Rolling back will permanently change the workflow. Consider creating a backup version first.'
      }
    });
  } catch (error) {
    console.error('Failed to preview rollback:', error);
    res.status(500).json({
      error: 'Failed to preview rollback',
      details: error.message
    });
  }
});

module.exports = router;