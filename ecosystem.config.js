// Load environment variables from .env file
require('dotenv').config();

// Get root directory dynamically
const path = require('path');
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
      },
    },
  ],
};
