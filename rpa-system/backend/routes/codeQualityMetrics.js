const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createLogger } = require('../middleware/structuredLogging');

const logger = createLogger('code-quality-metrics');
const execAsync = promisify(exec);

// ✅ SECURITY: Rate limit expensive system command execution
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const systemCommandLimiter = rateLimit({
 windowMs: 60 * 1000, // 1 minute
 max: isDevelopment || isTest ? 500 : 5, // Much higher in dev/test
 message: 'Too many requests, please try again later',
 standardHeaders: true,
 legacyHeaders: false,
 skip: () => isDevelopment || isTest // Skip entirely in dev/test
});

/**
 * GET /metrics/code-quality
 * Exports code quality metrics in Prometheus format
 * This endpoint is scraped by Prometheus to track code quality over time
 */
router.get('/code-quality', systemCommandLimiter, async (req, res) => {
 try {
 // Run the export script to generate metrics
 const scriptPath = path.join(__dirname, '../../../scripts/export-quality-metrics.sh');
 const metricsFile = '/tmp/easyflow-code-quality-metrics.prom';

 try {
 // Run export script
 await execAsync(`bash "${scriptPath}"`);

 // Read metrics file
 const metrics = await fs.readFile(metricsFile, 'utf-8');

 res.set('Content-Type', 'text/plain; version=0.0.4');
 res.send(metrics);

 logger.debug('Code quality metrics exported successfully');
 } catch (error) {
 logger.warn('Failed to export code quality metrics, returning empty metrics', { error: error.message });

 // Return empty metrics so Prometheus doesn't fail
 res.set('Content-Type', 'text/plain; version=0.0.4');
 res.send(`# Code quality metrics temporarily unavailable
# HELP easyflow_code_quality_total_files Total number of files scanned
# TYPE easyflow_code_quality_total_files gauge
easyflow_code_quality_total_files 0
# HELP easyflow_code_quality_total_issues Total number of code quality issues
# TYPE easyflow_code_quality_total_issues gauge
easyflow_code_quality_total_issues 0
# HELP easyflow_code_quality_issues_by_severity Code quality issues by severity
# TYPE easyflow_code_quality_issues_by_severity gauge
easyflow_code_quality_issues_by_severity{severity="high"} 0
easyflow_code_quality_issues_by_severity{severity="medium"} 0
easyflow_code_quality_issues_by_severity{severity="low"} 0
# HELP easyflow_code_quality_last_scan Timestamp of last quality scan
# TYPE easyflow_code_quality_last_scan gauge
easyflow_code_quality_last_scan 0
`);
 }
 } catch (error) {
 logger.error('Error in code quality metrics endpoint', { error: error.message });
 res.status(500).send('# Error generating code quality metrics\n');
 }
});

module.exports = router;

