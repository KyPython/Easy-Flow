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
    // Backend API Server (Node.js)
    {
      name: 'easyflow-backend',
      script: 'server.js',
      cwd: 'rpa-system/backend',
      watch: ['rpa-system/backend'],
      ignore_watch: ['node_modules', 'logs'],
      error_file: path.join(ROOT_DIR, 'logs/backend.log'),
      out_file: path.join(ROOT_DIR, 'logs/backend.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: process.env.PORT || '3030',
        NODE_ENV: process.env.NODE_ENV || 'development',
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
        KAFKA_ENABLED: process.env.KAFKA_ENABLED || 'true',
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || '127.0.0.1:9092',
      },
    },
    // Automation Worker (Python)
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
    // Frontend (React)
    {
      name: 'easyflow-frontend',
      script: 'npm',
      args: 'start',
      cwd: 'rpa-system/rpa-dashboard',
      error_file: path.join(ROOT_DIR, 'logs/frontend.log'),
      out_file: path.join(ROOT_DIR, 'logs/frontend.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: '3000',
        BROWSER: 'none',
        NODE_ENV: process.env.NODE_ENV || 'development',
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
