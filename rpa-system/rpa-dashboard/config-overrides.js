// Minimal config to get React running
module.exports = function override(config, env) {
  // Basic fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: false,
    path: false,
    stream: false,
    buffer: false,
  };
  
  // Configure dev server for SPA routing and selective API proxying
  if (config.devServer) {
    // CRITICAL: Proxy configuration - must be an object (not array) for webpack-dev-server
    // This ensures /api/* requests are forwarded to backend BEFORE historyApiFallback
    config.devServer.proxy = {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        // Ensure cookies and credentials are forwarded
        cookieDomainRewrite: 'localhost',
        // Ensure WebSocket connections are proxied correctly
        ws: true,
        // Preserve headers for proper CORS handling
        headers: {
          'Connection': 'keep-alive',
        },
      },
    };
    
    // Ensure SPA routes are handled correctly - serve index.html for all routes
    // This prevents 404 errors when navigating to routes like /auth
    // IMPORTANT: Proxy middleware runs BEFORE historyApiFallback, so /api/* won't hit this
    config.devServer.historyApiFallback = {
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    };
  }
  
  return config;
};
