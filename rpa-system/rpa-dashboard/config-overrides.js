// Minimal config to get React running
const webpack = require('webpack');

module.exports = function override(config, env) {
  // Basic fallbacks for node modules - CRITICAL: must be set before other config
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: false,
    path: require.resolve("path-browserify"), // This should handle the 'path' import
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    util: require.resolve("util"),
    os: require.resolve("os-browserify/browser"),
  };
  
  // Ensure fallbacks work for node_modules too
  config.resolve.modules = [
    ...(config.resolve.modules || ['node_modules']),
    'node_modules'
  ];
  
  // Replace Node.js-specific OpenTelemetry file with empty module to prevent webpack errors
  const path = require('path');
  const emptyModulePath = path.resolve(__dirname, 'src/utils/emptyModule.js');
  
  // CRITICAL: Use module rules to intercept the file BEFORE webpack tries to parse it
  // This runs before any parsing happens, preventing the 'path' import error
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  
  // Add a rule that replaces the problematic file with our empty module
  // This rule MUST come before other rules to intercept first
  config.module.rules.unshift({
    test: /instrumentationNodeModuleFile\.js$/,
    include: /@opentelemetry\/instrumentation/,
    // Use a custom loader that returns the empty module content
    use: [{
      loader: path.resolve(__dirname, 'webpack-loaders/empty-module-loader.js')
    }]
  });
  
  // Alias approach: replace at the module resolution level (happens BEFORE parsing)
  config.resolve.alias = {
    ...config.resolve.alias,
    // Directly alias the problematic file to our empty module - use absolute path
    '@opentelemetry/instrumentation/build/esm/instrumentationNodeModuleFile.js': emptyModulePath,
    // Also ensure 'path' resolves to path-browserify in ALL contexts
    'path': require.resolve("path-browserify"),
  };
  
  config.plugins = [
    ...config.plugins,
    // Replace the problematic Node.js-specific file with an empty module
    // Use absolute path matching to be more specific
    new webpack.NormalModuleReplacementPlugin(
      /.*instrumentationNodeModuleFile\.js$/,
      emptyModulePath
    ),
    // Ignore it entirely - this should prevent webpack from even trying to parse it
    new webpack.IgnorePlugin({
      checkResource(resource, context) {
        // Ignore the Node.js module file - check both resource and context
        const shouldIgnore = 
          (resource && resource.includes('instrumentationNodeModuleFile.js')) ||
          (context && context.includes('instrumentationNodeModuleFile.js'));
        return shouldIgnore;
      }
    })
  ];
  
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
