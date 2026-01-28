
const { logger, getLogger } = require('../utils/logger');
/**
 * Data Retention API Routes
 *
 * Admin endpoints for managing data retention policies and running cleanup operations
 */

const express = require('express');
const { dataRetentionService } = require('../services/dataRetentionService');
const { auditLogger } = require('../utils/auditLogger');
const { requireFeature } = require('../middleware/planEnforcement');
const router = express.Router();

// All data retention endpoints require the 'data_retention' feature
const requireDataRetention = requireFeature('data_retention');

/**
 * GET /api/data-retention/status
 * Get data retention service status and configuration
 */
router.get('/status', requireDataRetention, async (req, res) => {
 try {
 const status = dataRetentionService.getServiceStatus();

 await auditLogger.logUserAction(
 req.user.id,
 'view_data_retention_status',
 { endpoint: '/status' },
 req
 );

 res.json({
 success: true,
 data: status
 });
 } catch (error) {
 logger.error('Failed to get retention status:', error);
 res.status(500).json({
 error: 'Failed to get retention service status',
 details: error.message
 });
 }
});

/**
 * GET /api/data-retention/statistics
 * Get data retention statistics showing what data is eligible for cleanup
 */
router.get('/statistics', requireDataRetention, async (req, res) => {
 try {
 const stats = await dataRetentionService.getRetentionStatistics();

 await auditLogger.logUserAction(
 req.user.id,
 'view_retention_statistics',
 { endpoint: '/statistics' },
 req
 );

 res.json({
 success: true,
 data: stats
 });
 } catch (error) {
 logger.error('Failed to get retention statistics:', error);
 res.status(500).json({
 error: 'Failed to get retention statistics',
 details: error.message
 });
 }
});

/**
 * POST /api/data-retention/cleanup
 * Run comprehensive data cleanup or specific cleanup type
 */
router.post('/cleanup', requireDataRetention, async (req, res) => {
 try {
 const { type } = req.body;

 let result;
 if (type && type !== 'all') {
 // Run specific cleanup
 result = await dataRetentionService.runSpecificCleanup(type);

 await auditLogger.logUserAction(
 req.user.id,
 'run_specific_data_cleanup',
 {
 cleanup_type: type,
 result: result
 },
 req
 );
 } else {
 // Run full cleanup
 result = await dataRetentionService.runFullCleanup();

 await auditLogger.logUserAction(
 req.user.id,
 'run_full_data_cleanup',
 {
 total_cleaned: result.total_cleaned,
 duration_ms: result.duration_ms
 },
 req
 );
 }

 res.json({
 success: true,
 message: type && type !== 'all'
 ? `${type} cleanup completed successfully`
 : 'Full data cleanup completed successfully',
 data: result
 });
 } catch (error) {
 logger.error('Data cleanup failed:', error);

 await auditLogger.logUserAction(
 req.user.id,
 'data_cleanup_failed',
 {
 error: error.message,
 cleanup_type: req.body.type
 },
 req
 );

 res.status(500).json({
 error: 'Data cleanup failed',
 details: error.message
 });
 }
});

/**
 * PUT /api/data-retention/policy
 * Update retention policy for a specific data type
 */
router.put('/policy', requireDataRetention, async (req, res) => {
 try {
 const { dataType, subType, retentionDays } = req.body;

 // Validation
 if (!dataType || typeof retentionDays !== 'number' || retentionDays < 1) {
 return res.status(400).json({
 error: 'Invalid request. dataType and retentionDays (positive number) are required'
 });
 }

 if (retentionDays > 3650) { // Max 10 years
 return res.status(400).json({
 error: 'Retention period cannot exceed 3650 days (10 years)'
 });
 }

 dataRetentionService.setRetentionPolicy(dataType, subType, retentionDays);

 await auditLogger.logUserAction(
 req.user.id,
 'update_retention_policy',
 {
 data_type: dataType,
 sub_type: subType,
 retention_days: retentionDays,
 previous_policy: dataRetentionService.retentionPolicies[dataType]
 },
 req
 );

 res.json({
 success: true,
 message: `Retention policy updated for ${dataType}${subType ? `.${subType}` : ''}`,
 data: {
 dataType,
 subType,
 retentionDays,
 current_policies: dataRetentionService.retentionPolicies[dataType]
 }
 });
 } catch (error) {
 logger.error('Failed to update retention policy:', error);
 res.status(500).json({
 error: 'Failed to update retention policy',
 details: error.message
 });
 }
});

/**
 * POST /api/data-retention/start
 * Start the automatic cleanup scheduler
 */
router.post('/start', requireDataRetention, async (req, res) => {
 try {
 dataRetentionService.startScheduledCleanup();

 await auditLogger.logUserAction(
 req.user.id,
 'start_retention_scheduler',
 { endpoint: '/start' },
 req
 );

 res.json({
 success: true,
 message: 'Data retention scheduler started successfully'
 });
 } catch (error) {
 logger.error('Failed to start retention scheduler:', error);
 res.status(500).json({
 error: 'Failed to start retention scheduler',
 details: error.message
 });
 }
});

/**
 * POST /api/data-retention/stop
 * Stop the automatic cleanup scheduler
 */
router.post('/stop', requireDataRetention, async (req, res) => {
 try {
 dataRetentionService.stopScheduledCleanup();

 await auditLogger.logUserAction(
 req.user.id,
 'stop_retention_scheduler',
 { endpoint: '/stop' },
 req
 );

 res.json({
 success: true,
 message: 'Data retention scheduler stopped successfully'
 });
 } catch (error) {
 logger.error('Failed to stop retention scheduler:', error);
 res.status(500).json({
 error: 'Failed to stop retention scheduler',
 details: error.message
 });
 }
});

/**
 * GET /api/data-retention/policies
 * Get all current retention policies
 */
router.get('/policies', requireDataRetention, async (req, res) => {
 try {
 const policies = dataRetentionService.retentionPolicies;

 await auditLogger.logUserAction(
 req.user.id,
 'view_retention_policies',
 { endpoint: '/policies' },
 req
 );

 res.json({
 success: true,
 data: {
 policies,
 descriptions: {
 audit_logs: {
 default: 'General audit log entries',
 security_events: 'Security-related events (longer retention for compliance)',
 authentication: 'Authentication events'
 },
 workflow_executions: {
 completed: 'Successfully completed workflow executions',
 failed: 'Failed workflow executions (longer retention for debugging)',
 sensitive_payload: 'Sensitive input/output data (cleared but execution metadata retained)'
 },
 step_executions: {
 default: 'Individual step execution records',
 error_logs: 'Step executions with errors (longer retention for debugging)'
 },
 user_data: {
 inactive_accounts: 'Data for inactive user accounts',
 deleted_accounts: 'Grace period for deleted user accounts'
 },
 temporary_files: {
 uploads: 'Temporary uploaded files (in hours)',
 exports: 'Temporary export files (in hours)'
 }
 }
 }
 });
 } catch (error) {
 logger.error('Failed to get retention policies:', error);
 res.status(500).json({
 error: 'Failed to get retention policies',
 details: error.message
 });
 }
});

/**
 * POST /api/data-retention/preview
 * Preview what data would be cleaned up without actually deleting it
 */
router.post('/preview', requireDataRetention, async (req, res) => {
 try {
 const { type } = req.body;

 // This would need to be implemented in the service to return counts without deletion
 // For now, return the current statistics as a preview
 const stats = await dataRetentionService.getRetentionStatistics();

 await auditLogger.logUserAction(
 req.user.id,
 'preview_data_cleanup',
 {
 cleanup_type: type || 'all',
 endpoint: '/preview'
 },
 req
 );

 res.json({
 success: true,
 message: 'Data cleanup preview (actual cleanup functionality pending)',
 data: {
 type: type || 'all',
 preview: stats,
 note: 'This shows current data eligible for cleanup based on retention policies'
 }
 });
 } catch (error) {
 logger.error('Failed to preview cleanup:', error);
 res.status(500).json({
 error: 'Failed to preview cleanup',
 details: error.message
 });
 }
});

module.exports = router;
