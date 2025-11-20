
const { logger, getLogger } = require('./utils/logger');
// Fast server startup
const app = require('./app_fast');

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    logger.info(`🚀 EasyFlow backend (fast) listening on http://${HOST}:${PORT}`);
    logger.info(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
    });
  });
}