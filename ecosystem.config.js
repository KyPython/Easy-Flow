// PM2 ecosystem configuration for EasyFlow
module.exports = {
  apps: [
    {
      name: 'easyflow-backend',
      script: 'rpa-system/backend/server.js',
      cwd: '/Users/ky/Easy-Flow',
      env: {
        NODE_ENV: 'development',
        PORT: 3030,
        LOG_LEVEL: 'info',
        KAFKA_ENABLED: 'true',
        KAFKA_BOOTSTRAP_SERVERS: 'localhost:9092',
        KAFKA_BROKERS: 'localhost:9092'
      },
      error_file: 'logs/backend-error.log',
      out_file: 'logs/backend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: ['rpa-system/backend'],
      ignore_watch: ['node_modules', 'logs', '*.log']
    },
    {
      name: 'easyflow-frontend',
      script: 'node_modules/.bin/react-scripts',
      args: 'start',
      cwd: '/Users/ky/Easy-Flow/rpa-system/rpa-dashboard',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        BROWSER: 'none'
      },
      error_file: 'logs/frontend-error.log',
      out_file: 'logs/frontend.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      watch: false
    },
    {
      name: 'easyflow-automation',
      script: 'rpa-system/automation/automation-service/production_automation_service.py',
      cwd: '/Users/ky/Easy-Flow',
      interpreter: 'python3',
      env: {
        PYTHONUNBUFFERED: '1',
        FLASK_ENV: 'development',
        KAFKA_BOOTSTRAP_SERVERS: 'localhost:9092'
      },
      error_file: 'logs/automation-worker.log',
      out_file: 'logs/automation-worker.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      watch: false
    }
  ]
};
