/**
 * Configuration Health Check
 * Validates all critical configuration at startup to prevent cascade failures
 */

const { logger } = require('./logger');
const { validateFirebaseConfig, getFrontendConfigInfo } = require('./firebaseConfigValidator');

/**
 * Run comprehensive configuration health check at startup
 * This prevents the authentication cascade by catching all config issues early
 */
function runConfigHealthCheck() {
 logger.info('\n🔍 Running configuration health check...\n');

 const results = {
 firebase: null,
 supabase: null,
 integrations: null,
 overall: { healthy: true, errors: [], warnings: [] }
 };

 // 1. Firebase Configuration Check
 try {
 const firebaseResult = validateFirebaseConfig();
 results.firebase = firebaseResult;

 if (!firebaseResult.valid) {
 results.overall.healthy = false;
 results.overall.errors.push(...firebaseResult.errors.map(e => `Firebase: ${e.message}`));
 }
 if (firebaseResult.warnings.length > 0) {
 results.overall.warnings.push(...firebaseResult.warnings.map(w => `Firebase: ${w.message}`));
 }
 } catch (error) {
 logger.error('Firebase config validation failed:', error);
 results.firebase = { valid: false, error: error.message };
 results.overall.healthy = false;
 results.overall.errors.push(`Firebase validation error: ${error.message}`);
 }

 // 2. Supabase Configuration Check
 try {
 const supabaseUrl = process.env.SUPABASE_URL;
 const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

 if (!supabaseUrl || !supabaseKey) {
 results.overall.warnings.push('Supabase: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
 results.supabase = { valid: false, missing: !supabaseUrl ? 'SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY' };
 } else {
 results.supabase = { valid: true };
 }
 } catch (error) {
 logger.error('Supabase config check failed:', error);
 results.supabase = { valid: false, error: error.message };
 }

 // 3. Integration Configuration Check
 try {
 const integrationIssues = [];
 const requiredIntegrations = {
 slack: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'],
 google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
 };

 for (const [service, vars] of Object.entries(requiredIntegrations)) {
 const missing = vars.filter(v => !process.env[v]);
 if (missing.length > 0) {
 integrationIssues.push(`${service}: Missing ${missing.join(', ')}`);
 }
 }

 if (integrationIssues.length > 0) {
 results.overall.warnings.push(...integrationIssues.map(i => `Integration: ${i}`));
 results.integrations = { valid: false, issues: integrationIssues };
 } else {
 results.integrations = { valid: true };
 }
 } catch (error) {
 logger.error('Integration config check failed:', error);
 results.integrations = { valid: false, error: error.message };
 }

 // Summary
 logger.info('\n📊 Configuration Health Check Summary:');
 logger.info(` Firebase: ${results.firebase?.valid ? '✅' : '❌'} ${results.firebase?.matches ? '(Project ID matches)' : '(Project ID mismatch or missing)'}`);
 logger.info(` Supabase: ${results.supabase?.valid ? '✅' : '⚠️'}`);
 logger.info(` Integrations: ${results.integrations?.valid ? '✅' : '⚠️'}`);
 logger.info(` Overall: ${results.overall.healthy ? '✅ Healthy' : '❌ Issues Found'}\n`);

 if (results.overall.errors.length > 0) {
 logger.error('❌ Configuration Errors (will cause failures):');
 results.overall.errors.forEach(err => logger.error(` - ${err}`));
 logger.error('');
 }

 if (results.overall.warnings.length > 0) {
 logger.warn('⚠️ Configuration Warnings (features may be disabled):');
 results.overall.warnings.forEach(warn => logger.warn(` - ${warn}`));
 logger.warn('');
 }

 // In development, fail if critical errors exist
 if (!results.overall.healthy && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev')) {
 logger.error('🔥 CRITICAL: Configuration errors detected. Server will not start in development mode.');
 logger.error('Please fix the configuration errors above before starting the server.\n');
 return { healthy: false, shouldExit: true, results };
 }

 return { healthy: results.overall.healthy, shouldExit: false, results };
}

module.exports = {
 runConfigHealthCheck
};

