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
        SUPABASE_URL: "https://syxzilyuysdoirnezgii.supabase.co",
        SUPABASE_SERVICE_ROLE: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk",
        SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0",
        // OPENAI_API_KEY loaded from .env by dotenv
        OPENAI_MODEL: "gpt-4-turbo-preview"
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
        SUPABASE_URL: "https://syxzilyuysdoirnezgii.supabase.co",
        SUPABASE_SERVICE_ROLE: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjM5NzMxMCwiZXhwIjoyMDcxOTczMzEwfQ.pqi4cVHTSjWmwhCJcraoJgOc7UCw4fjuSTrlv_6oVwk",
        SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eHppbHl1eXNkb2lybmV6Z2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTczMTAsImV4cCI6MjA3MTk3MzMxMH0.mfPrYidyc3DEbTmmQuZhmuqqCjV_DE4JWZiv7-n5nE0"
      },
    },
  ],
};
