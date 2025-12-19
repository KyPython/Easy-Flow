module.exports = {
  apps: [
    {
      name: 'easyflow-backend',
      script: 'server.js',
      cwd: 'rpa-system/backend',
      watch: ['rpa-system/backend'],
      ignore_watch: ['node_modules', 'logs'],
      error_file: '/Users/ky/Easy-Flow/logs/backend-error.log',
      out_file: '/Users/ky/Easy-Flow/logs/backend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        KAFKA_ENABLED: 'true',
        AUTOMATION_URL: 'http://127.0.0.1:7070',
        KAFKA_CLIENT_ID: 'easyflow-backend',
        KAFKA_BOOTSTRAP_SERVERS: '127.0.0.1:9092',
        KAFKA_BROKERS: '127.0.0.1:9092',
        // ✅ SECURITY: Use environment variables instead of hardcoded secrets
        SUPABASE_URL: process.env.SUPABASE_URL || "",
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || "",
        SUPABASE_KEY: process.env.SUPABASE_KEY || "",
        // OPENAI_API_KEY loaded from .env by dotenv
        OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo-preview"
      },
    },
    {
      name: 'easyflow-frontend',
      script: 'node_modules/.bin/react-scripts',
      args: 'start',
      cwd: 'rpa-system/rpa-dashboard',
      error_file: '/Users/ky/Easy-Flow/logs/frontend-error.log',
      out_file: '/Users/ky/Easy-Flow/logs/frontend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PORT: 3000,
        BROWSER: 'none'
      },
    },
    {
      name: 'easyflow-automation',
      script: 'production_automation_service.py',
      interpreter: 'python3',
      cwd: 'rpa-system/automation/automation-service',
      error_file: '/Users/ky/Easy-Flow/logs/automation-worker.log',
      out_file: '/Users/ky/Easy-Flow/logs/automation-worker.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        PYTHONUNBUFFERED: '1',
        KAFKA_ENABLED: 'true',
        PORT: 7070,
        BACKEND_URL: 'http://127.0.0.1:3030',
        KAFKA_BOOTSTRAP_SERVERS: '127.0.0.1:9092',
        KAFKA_BROKERS: '127.0.0.1:9092',
        // ✅ SECURITY: Use environment variables instead of hardcoded secrets
        SUPABASE_URL: process.env.SUPABASE_URL || "",
        SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE || "",
        SUPABASE_KEY: process.env.SUPABASE_KEY || ""
      },
    },
  ],
};
