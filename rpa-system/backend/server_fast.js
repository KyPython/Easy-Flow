// Fast server startup
const app = require('./app_fast');

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 EasyFlow backend (fast) listening on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
}