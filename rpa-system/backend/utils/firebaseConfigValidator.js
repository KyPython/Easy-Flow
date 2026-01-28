/**
 * Firebase Configuration Validator
 * Validates that backend and frontend Firebase configurations match
 * Prevents authentication cascade failures
 */

const { logger } = require('./logger');

// Expected Firebase project ID (must match frontend)
const EXPECTED_PROJECT_ID = 'easyflow-77db9';

/**
 * Validate Firebase configuration at startup
 * This prevents the authentication cascade by catching mismatches early
 */
function validateFirebaseConfig() {
 const projectId = process.env.FIREBASE_PROJECT_ID;
 const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
 const privateKey = process.env.FIREBASE_PRIVATE_KEY;

 const errors = [];
 const warnings = [];

 // Critical: Project ID must match frontend
 if (projectId && projectId !== EXPECTED_PROJECT_ID) {
 errors.push({
 type: 'PROJECT_ID_MISMATCH',
 severity: 'CRITICAL',
 message: `Firebase Project ID mismatch: Backend uses '${projectId}' but frontend expects '${EXPECTED_PROJECT_ID}'`,
 impact: 'This will cause 401 authentication failures, FCM failures, and cascade to Supabase real-time instability',
 fix: `Set FIREBASE_PROJECT_ID=${EXPECTED_PROJECT_ID} in backend .env file`
 });
 } else if (!projectId) {
 warnings.push({
 type: 'MISSING_PROJECT_ID',
 severity: 'HIGH',
 message: 'FIREBASE_PROJECT_ID is not set',
 impact: 'Firebase Admin cannot initialize, notifications will be disabled',
 fix: `Set FIREBASE_PROJECT_ID=${EXPECTED_PROJECT_ID} in backend .env file`
 });
 }

 // Check required credentials
 if (!clientEmail) {
 warnings.push({
 type: 'MISSING_CLIENT_EMAIL',
 severity: 'HIGH',
 message: 'FIREBASE_CLIENT_EMAIL is not set',
 impact: 'Firebase Admin cannot initialize, notifications will be disabled',
 fix: 'Set FIREBASE_CLIENT_EMAIL in backend .env file'
 });
 }

 if (!privateKey) {
 warnings.push({
 type: 'MISSING_PRIVATE_KEY',
 severity: 'HIGH',
 message: 'FIREBASE_PRIVATE_KEY is not set',
 impact: 'Firebase Admin cannot initialize, notifications will be disabled',
 fix: 'Set FIREBASE_PRIVATE_KEY in backend .env file'
 });
 }

 // Log errors and warnings
 if (errors.length > 0) {
 logger.error('\n🔥🔥🔥 FIREBASE CONFIGURATION ERRORS 🔥🔥🔥\n');
 errors.forEach(error => {
 logger.error(`[${error.type}] ${error.message}`);
 logger.error(` Impact: ${error.impact}`);
 logger.error(` Fix: ${error.fix}\n`);
 });

 // In development, throw to prevent silent failure
 if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
 const errorMessage = errors.map(e => `${e.message}\n Fix: ${e.fix}`).join('\n\n');
 throw new Error(
 `\n🔥 FATAL: Firebase Configuration Errors\n\n${errorMessage}\n\n` +
 'These errors will cause authentication failures and cascade through the system.\n' +
 'Please fix the configuration before starting the server.\n'
 );
 }
 }

 if (warnings.length > 0) {
 logger.warn('\n⚠️ FIREBASE CONFIGURATION WARNINGS ⚠️\n');
 warnings.forEach(warning => {
 logger.warn(`[${warning.type}] ${warning.message}`);
 logger.warn(` Impact: ${warning.impact}`);
 logger.warn(` Fix: ${warning.fix}\n`);
 });
 }

 // Success message if all checks pass
 if (errors.length === 0 && warnings.length === 0) {
 logger.info('✅ Firebase configuration validated successfully', {
 project_id: projectId,
 project_id_matches_frontend: projectId === EXPECTED_PROJECT_ID,
 has_credentials: !!(clientEmail && privateKey)
 });
 }

 return {
 valid: errors.length === 0,
 errors,
 warnings,
 projectId,
 expectedProjectId: EXPECTED_PROJECT_ID,
 matches: projectId === EXPECTED_PROJECT_ID
 };
}

/**
 * Validate frontend Firebase configuration (for reference)
 * This helps identify mismatches between frontend and backend
 */
function getFrontendConfigInfo() {
 return {
 expectedProjectId: EXPECTED_PROJECT_ID,
 requiredEnvVars: [
 'REACT_APP_FIREBASE_PROJECT_ID',
 'REACT_APP_FIREBASE_API_KEY',
 'REACT_APP_FIREBASE_AUTH_DOMAIN',
 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
 'REACT_APP_FIREBASE_APP_ID'
 ],
 note: 'Frontend config is in rpa-system/rpa-dashboard/.env.local or Vercel environment variables'
 };
}

module.exports = {
 validateFirebaseConfig,
 getFrontendConfigInfo,
 EXPECTED_PROJECT_ID
};

