
const { logger, getLogger } = require('../utils/logger');
/**
 * Audit Logs API Routes
 * Provides endpoints for accessing and managing audit logs
 */


const express = require('express');
const router = express.Router();
const { auditLogger } = require('../utils/auditLogger');
const { getSupabase } = require('../utils/supabaseClient');
const { requireFeature } = require('../middleware/planEnforcement');
const { createLogger } = require('../middleware/structuredLogging');

// Use centralized Supabase helper (returns null when not configured)
// const supabase = getSupabase(); // resolved per-request inside handlers

/**
 * Middleware to check if user is admin (for system-wide logs)
 */
const requireAdmin = async (req, res, next) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 // Check if user has admin role
 const supabase = getSupabase();
 if (!supabase) return res.status(503).json({ error: 'Supabase not configured on server' });

 const { data: user, error } = await supabase
 .from('profiles')
 .select('role')
 .eq('id', userId)
 .single();

 if (error) {
 logger.error('Admin check failed:', error);
 return res.status(500).json({ error: 'Failed to verify admin status' });
 }

 if (user?.role !== 'admin') {
 await auditLogger.logSecurityEvent(
 userId,
 'unauthorized_admin_access_attempt',
 'medium',
 { attempted_endpoint: req.path },
 req
 );
 return res.status(403).json({ error: 'Admin access required' });
 }

 next();
 } catch (error) {
 logger.error('Admin middleware error:', error);
 res.status(500).json({ error: 'Internal server error' });
 }
};

/**
 * GET /api/audit-logs/user
 * Get audit logs for the current user
 */
router.get('/user', requireFeature('audit_logs'), async (req, res) => {
 // Create logger with business context for this operation
 const logger = createLogger('api.audit_logs')
 .withUser(req.user)
 .withOperation('get_user_audit_logs', {
 endpoint: '/api/audit-logs/user',
 method: 'GET'
 });

 try {
 const userId = req.user?.id;
 if (!userId) {
 logger.warn('Unauthorized audit log access attempt', {
 security: { event: 'unauthorized_access', outcome: 'denied' }
 });
 return res.status(401).json({ error: 'Authentication required' });
 }

 logger.info('Fetching user audit logs', {
 business: {
 user: { user_id: userId, user_tier: req.user?.tier },
 operation: { operation_name: 'get_user_audit_logs' }
 }
 });

 // --- Per-plan log retention enforcement ---
 let retentionDays = 30; // Default fallback
 try {
 // Use backend supabase client
 const supabase = getSupabase();
 if (!supabase) {
 logger.warn('Supabase not configured, using default retention');
 } else {
 const { data: planData } = await supabase.rpc('get_user_plan_details', { user_uuid: userId });
 if (planData && planData.plan_limits && planData.plan_limits.full_logging_days) {
 retentionDays = planData.plan_limits.full_logging_days;
 }
 }
 } catch (error) {
 logger.warn('Failed to fetch plan retention policy', { error: error?.message });
 }

 logger.debug('Plan retention policy applied', {
 business: {
 user: { user_id: userId },
 operation: { retention_days: retentionDays }
 }
 });
 const retentionStart = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

 const {
 startDate,
 endDate,
 actionType,
 action,
 limit,
 offset,
 search
 } = req.query || {};

 // ✅ SECURITY: Validate types before using (prevent type confusion attacks)
 // Ensure req.query is an object
 if (!req.query || typeof req.query !== 'object') {
 return res.status(400).json({ error: 'Invalid query parameters' });
 }
 const safeLimit = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 50);
 const safeOffset = typeof offset === 'string' ? parseInt(offset, 10) : (typeof offset === 'number' ? offset : 0);
 const safeSearch = typeof search === 'string' ? search : (search && typeof search === 'object' ? undefined : (search ? String(search) : undefined));

 // Enforce retention window
 const effectiveStart = startDate && new Date(startDate) > retentionStart ? startDate : retentionStart.toISOString();
 const effectiveEnd = endDate;

 let result;

 // ✅ SECURITY: Validate type before using string methods
 if (safeSearch) {
 // Use search functionality
 result = await auditLogger.searchAuditLogs(safeSearch, {
 userId,
 actionType,
 startDate: effectiveStart,
 endDate: effectiveEnd,
 limit: safeLimit,
 offset: safeOffset
 });
 result = {
 logs: result.results,
 total: result.total,
 limit: safeLimit,
 offset: safeOffset
 };
 } else {
 // Regular filtered query
 result = await auditLogger.getUserAuditLogs(userId, {
 startDate: effectiveStart,
 endDate: effectiveEnd,
 actionType,
 limit: parseInt(limit),
 offset: parseInt(offset)
 });
 }

 res.json(result);
 } catch (error) {
 logger.error('Failed to fetch user audit logs:', error);
 await auditLogger.logSystemEvent('error', 'audit_logs_fetch_failed', {
 error: error.message
 }, req.user.id);
 res.status(500).json({ error: 'Failed to fetch audit logs' });
 }
});

/**
 * GET /api/audit-logs/system
 * Get system-wide audit logs (admin only)
 */
router.get('/system', requireAdmin, requireFeature('audit_logs_admin'), async (req, res) => {
 try {
 const {
 startDate,
 endDate,
 actionType,
 userId,
 severity,
 limit,
 offset,
 search
 } = req.query || {};

 // ✅ SECURITY: Validate types before using (prevent type confusion attacks)
 // Ensure req.query is an object
 if (!req.query || typeof req.query !== 'object') {
 return res.status(400).json({ error: 'Invalid query parameters' });
 }
 const safeLimit = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 100);
 const safeOffset = typeof offset === 'string' ? parseInt(offset, 10) : (typeof offset === 'number' ? offset : 0);
 // ✅ SECURITY: Ensure search is a string or undefined (never null/object)
 const safeSearch = typeof search === 'string' ? search : (search && typeof search === 'object' ? undefined : (search !== null && search !== undefined ? String(search) : undefined));

 let result;

 // ✅ SECURITY: Validate type before using string methods
 if (safeSearch) {
 // Use search functionality
 result = await auditLogger.searchAuditLogs(safeSearch, {
 userId,
 actionType,
 startDate,
 endDate,
 limit: safeLimit,
 offset: safeOffset
 });
 result = {
 logs: result.results,
 total: result.total,
 limit: safeLimit,
 offset: safeOffset
 };
 } else {
 // Regular filtered query
 result = await auditLogger.getSystemAuditLogs({
 startDate,
 endDate,
 actionType,
 userId,
 severity,
 limit: parseInt(limit),
 offset: parseInt(offset)
 });
 }

 // Log the admin access
 await auditLogger.logDataAccess(req.user.id, 'system_audit_logs', 'read', {
 filters: req.query,
 results_count: result.logs.length
 });

 res.json(result);
 } catch (error) {
 logger.error('Failed to fetch system audit logs:', error);

 await auditLogger.logSystemEvent('error', 'system_audit_logs_fetch_failed', {
 error: error.message,
 admin_user: req.user?.id
 }, req.user?.id);

 res.status(500).json({ error: 'Failed to fetch system audit logs' });
 }
});

/**
 * GET /api/audit-logs/system/stats
 * Get system-wide audit statistics (admin only)
 */
router.get('/system/stats', requireAdmin, requireFeature('audit_logs_admin'), async (req, res) => {
 try {
 const { timeframe = '24h' } = req.query;
 const stats = await auditLogger.getAuditStatistics(null, timeframe);

 // Add additional system stats
 const systemStats = await getSystemStatistics(timeframe);
 const combinedStats = {
 ...stats,
 system: systemStats
 };

 await auditLogger.logDataAccess(req.user.id, 'system_audit_stats', 'read', {
 timeframe
 });

 res.json(combinedStats);
 } catch (error) {
 logger.error('Failed to fetch system audit stats:', error);

 await auditLogger.logSystemEvent('error', 'system_audit_stats_fetch_failed', {
 error: error.message,
 admin_user: req.user?.id
 }, req.user?.id);

 res.status(500).json({ error: 'Failed to fetch system audit statistics' });
 }
});

/**
 * GET /api/audit-logs/export
 * Export audit logs as CSV (user's own logs)
 */
router.get('/export', requireFeature('audit_logs'), async (req, res) => {
 try {
 const userId = req.user?.id;
 if (!userId) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 const {
 startDate,
 endDate,
 actionType,
 format = 'csv'
 } = req.query;

 // Get logs for export
 const result = await auditLogger.getUserAuditLogs(userId, {
 startDate,
 endDate,
 actionType,
 limit: 10000 // Large limit for export
 });

 if (format.toLowerCase() === 'csv') {
 const csv = convertLogsToCSV(result.logs);

 const filename = `audit_logs_${userId}_${new Date().toISOString().split('T')[0]}.csv`;

 res.setHeader('Content-Type', 'text/csv');
 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
 res.send(csv);
 } else if (format.toLowerCase() === 'json') {
 const filename = `audit_logs_${userId}_${new Date().toISOString().split('T')[0]}.json`;

 res.setHeader('Content-Type', 'application/json');
 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
 res.json(result);
 } else {
 return res.status(400).json({ error: 'Unsupported format. Use csv or json.' });
 }

 // Log the export
 await auditLogger.logDataAccess(userId, 'audit_logs', 'export', {
 format,
 count: result.logs.length,
 filters: { startDate, endDate, actionType }
 });

 } catch (error) {
 logger.error('Failed to export audit logs:', error);

 if (req.user?.id) {
 await auditLogger.logSystemEvent('error', 'audit_logs_export_failed', {
 error: error.message,
 format: req.query.format
 }, req.user.id);
 }

 res.status(500).json({ error: 'Failed to export audit logs' });
 }
});

/**
 * DELETE /api/audit-logs/cleanup
 * Cleanup old audit logs (admin only)
 */
router.delete('/cleanup', requireAdmin, requireFeature('audit_logs_admin'), async (req, res) => {
 try {
 const { retentionDays = 365 } = req.query;

 const result = await auditLogger.cleanupOldLogs(parseInt(retentionDays));

 await auditLogger.logSystemEvent('info', 'audit_logs_cleanup', {
 ...result,
 retention_days: retentionDays,
 admin_user: req.user.id
 }, req.user.id);

 res.json({
 success: true,
 ...result
 });
 } catch (error) {
 logger.error('Failed to cleanup audit logs:', error);

 await auditLogger.logSystemEvent('error', 'audit_logs_cleanup_failed', {
 error: error.message,
 admin_user: req.user?.id
 }, req.user?.id);

 res.status(500).json({ error: 'Failed to cleanup audit logs' });
 }
});

/**
 * Helper function to get additional system statistics
 */
async function getSystemStatistics(timeframe) {
 const timeframes = {
 '1h': new Date(Date.now() - 60 * 60 * 1000),
 '24h': new Date(Date.now() - 24 * 60 * 60 * 1000),
 '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
 };

 const since = timeframes[timeframe] || timeframes['24h'];

 try {
 // Get active users
 const supabase = getSupabase();
 if (!supabase) {
 throw new Error('Supabase not configured on server');
 }
 const { data: activeUsers } = await supabase
 .from('audit_logs')
 .select('user_id')
 .gte('timestamp', since.toISOString())
 .not('user_id', 'is', null);

 const uniqueUsers = new Set(activeUsers?.map(log => log.user_id) || []);

 // Get security events
 const { data: securityEvents } = await supabase
 .from('audit_logs')
 .select('details')
 .eq('action_type', 'security_event')
 .gte('timestamp', since.toISOString());

 const securityStats = {
 total: securityEvents?.length || 0,
 by_severity: {}
 };

 securityEvents?.forEach(event => {
 const severity = event.details?.severity || 'unknown';
 securityStats.by_severity[severity] = (securityStats.by_severity[severity] || 0) + 1;
 });

 return {
 active_users: uniqueUsers.size,
 security_events: securityStats,
 timeframe: timeframe
 };
 } catch (error) {
 logger.error('Failed to get system statistics:', error);
 return {
 active_users: 0,
 security_events: { total: 0, by_severity: {} },
 timeframe: timeframe,
 error: error.message
 };
 }
}

/**
 * Helper function to convert logs to CSV format
 */
function convertLogsToCSV(logs) {
 if (!logs || logs.length === 0) {
 return 'timestamp,action_type,action,details,ip_address,user_agent\n';
 }

 const headers = ['timestamp', 'action_type', 'action', 'details', 'ip_address', 'user_agent'];
 const csvRows = [headers.join(',')];

 logs.forEach(log => {
 const row = [
 log.timestamp,
 log.action_type || '',
 log.action || '',
 JSON.stringify(log.details || {}),
 log.ip_address || '',
 log.user_agent || ''
 ];

 // Escape commas and quotes in CSV
 const escapedRow = row.map(field => {
 if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
 return `"${field.replace(/"/g, '""')}"`;
 }
 return field;
 });

 csvRows.push(escapedRow.join(','));
 });

 return csvRows.join('\n');
}

module.exports = router;
