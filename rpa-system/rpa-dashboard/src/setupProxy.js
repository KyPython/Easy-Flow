const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
 app.use(
 '/api',
 createProxyMiddleware({
 target: 'http://localhost:3030', // Backend runs on port 3030
 changeOrigin: true,
 secure: false,
 logLevel: 'debug',
 // Ensure cookies and credentials are forwarded
 cookieDomainRewrite: 'localhost',
 // Preserve headers for proper CORS handling
 headers: {
 'Connection': 'keep-alive',
 },
 })
 );
};

