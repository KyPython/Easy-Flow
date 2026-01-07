// Load environment variables from .env file
require('dotenv').config();

// Load frontend .env.local if it exists
const fs = require('fs');
const path = require('path');
const frontendEnvPath = path.join(__dirname, 'rpa-system/rpa-dashboard/.env.local');
if (fs.existsSync(frontendEnvPath)) {
 const frontendEnv = require('dotenv').config({ path: frontendEnvPath });
 if (frontendEnv.parsed) {
 console.log('Loaded frontend .env.local with', Object.keys(frontendEnv.parsed).length, 'variables');
 }
}

// Get root directory dynamically
const ROOT_DIR = __dirname;

module.exports = {
 apps: [
 {
 name: 'easyflow-backend',
 script: 'server.js',
 cwd: 'rpa-system/backend',
 watch: ['rpa-system/backend'],
 ignore_watch: ['node_modules', 'logs'],
 error_file: path.join(ROOT_DIR, 'logs/backend-error.log'),
 out_file: path.join(ROOT_DIR, 'logs/backend.log'),
 log_date_format: 'YYYY-MM-DD HH:mm:ss',
 merge_logs: true,
 env: {
 NODE_ENV: process.env.NODE_ENV || 'development',
 PORT: process.env.PORT || '3030',
 KAFKA_ENABLED: process.env.KAFKA_ENABLED || 'true',
 AUTOMATION_URL: process.env.AUTOMATION_URL || 'http://127.0.0.1:' + (process.env.AUTOMATION_PORT || '7070'),
 KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'easyflow-backend',
 KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || '127.0.0.1:9092',
 KAFKA_BROKERS: process.env.KAFKA_BROKERS || '127.0.0.1:9092',
 SUPABASE_URL: process.env.SUPABASE_URL,
 SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
 SUPABASE_KEY: process.env.SUPABASE_KEY,
 SESSION_SECRET: process.env.SESSION_SECRET,
 ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
 SUPABASE_BUCKET: process.env.SUPABASE_BUCKET,
 DEV_BYPASS_TOKEN: process.env.DEV_BYPASS_TOKEN,
 DEV_USER_ID: process.env.DEV_USER_ID,
 RAG_SERVICE_URL: process.env.RAG_SERVICE_URL || 'http://localhost:3002',
 },
 },
 {
 name: 'easyflow-frontend',
 script: 'node_modules/.bin/react-scripts',
 args: 'start',
 cwd: 'rpa-system/rpa-dashboard',
 error_file: path.join(ROOT_DIR, 'logs/frontend-error.log'),
 out_file: path.join(ROOT_DIR, 'logs/frontend.log'),
 log_date_format: 'YYYY-MM-DD HH:mm:ss',
 merge_logs: true,
 env: {
 PORT: process.env.FRONTEND_PORT || '3000',
 BROWSER: process.env.BROWSER || 'none',
 REACT_APP_API_BASE: process.env.REACT_APP_API_BASE,
 PUBLIC_URL: process.env.PUBLIC_URL,
 // Load all REACT_APP_ and VITE_ variables from .env.local
 ...Object.keys(process.env)
 .filter(key => key.startsWith('REACT_APP_') || key.startsWith('VITE_'))
 .reduce((acc, key) => {
 acc[key] = process.env[key];
 return acc;
 }, {}),
 },
 },
 {
 name: 'easyflow-automation',
 script: 'production_automation_service.py',
 interpreter: 'python3',
 cwd: 'rpa-system/automation/automation-service',
 error_file: path.join(ROOT_DIR, 'logs/automation-worker.log'),
 out_file: path.join(ROOT_DIR, 'logs/automation-worker.log'),
 log_date_format: 'YYYY-MM-DD HH:mm:ss',
 merge_logs: true,
 env: {
 PYTHONUNBUFFERED: process.env.PYTHONUNBUFFERED || '1',
 KAFKA_ENABLED: process.env.KAFKA_ENABLED || 'true',
 PORT: process.env.AUTOMATION_PORT || '7070',
 BACKEND_URL: process.env.BACKEND_URL || 'http://127.0.0.1:' + (process.env.PORT || '3030'),
 KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || '127.0.0.1:9092',
 KAFKA_BROKERS: process.env.KAFKA_BROKERS || '127.0.0.1:9092',
 SUPABASE_URL: process.env.SUPABASE_URL,
 SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
 SUPABASE_KEY: process.env.SUPABASE_KEY,
 ENV: process.env.ENV || process.env.NODE_ENV || 'development',
 NODE_ENV: process.env.NODE_ENV || process.env.ENV || 'development',
 },
 },
 ],
};

// ✅ FIX: Add RAG service to ecosystem config if it exists
const RAG_DIR = '/Users/ky/rag-node-ts';
if (fs.existsSync(RAG_DIR) && fs.existsSync(path.join(RAG_DIR, 'package.json'))) {
 try {
 const pkgJson = JSON.parse(fs.readFileSync(path.join(RAG_DIR, 'package.json'), 'utf8'));
 // Determine the start script (prefer 'start' for production, fallback to 'dev')
 // Use 'start' if dist exists (built version), otherwise use 'dev'
 const hasBuilt = fs.existsSync(path.join(RAG_DIR, 'dist', 'index.js'));
 const scriptName = (hasBuilt && pkgJson.scripts?.start) ? 'start' : (pkgJson.scripts?.dev ? 'dev' : (pkgJson.scripts?.start ? 'start' : 'dev'));
 
 module.exports.apps.push({
 name: 'rag-node-ts',
 script: 'npm',
 args: 'run ' + scriptName,
 cwd: RAG_DIR,
 interpreter: 'node',
 error_file: path.join(ROOT_DIR, 'logs/rag-error.log'),
 out_file: path.join(ROOT_DIR, 'logs/rag.log'),
 log_date_format: 'YYYY-MM-DD HH:mm:ss',
 merge_logs: true,
 env: {
 PORT: process.env.RAG_SERVICE_PORT || '3002',
 NODE_ENV: process.env.NODE_ENV || 'development',
 },
 });
 } catch (e) {
 // RAG service config failed, continue without it (non-critical)
 }
}
