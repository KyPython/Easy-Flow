// Minimal config to get React running
const webpack = require('webpack');

module.exports = function override(config, env) {
  // Basic fallbacks for node modules - CRITICAL: must be set before other config
  config.resolve = config.resolve || {};
  
  // CRITICAL: Ensure path-browserify is resolved BEFORE setting fallback
  const pathBrowserify = require.resolve("path-browserify");
  
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    crypto: false,
    // CRITICAL: path fallback MUST be set to pathBrowserify to handle OpenTelemetry imports
    path: pathBrowserify,
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    util: require.resolve("util"),
    os: require.resolve("os-browserify/browser"),
  };
  
  // CRITICAL: Also ensure path is available globally for ESM modules
  config.resolve.alias = {
    ...config.resolve.alias,
    'path': pathBrowserify,
    'path/': pathBrowserify,
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
  // CRITICAL: Use 'enforce: pre' to ensure this runs before any other loaders
  config.module.rules.unshift({
    enforce: 'pre',
    test: /instrumentationNodeModuleFile\.js$/,
    include: /@opentelemetry\/instrumentation/,
    // Use a custom loader that returns the empty module content
    use: [{
      loader: path.resolve(__dirname, 'webpack-loaders/empty-module-loader.js')
    }]
  });
  
  // Alias approach: replace at the module resolution level (happens BEFORE parsing)
  // CRITICAL: This must be set before any other alias configuration
  // Use multiple alias patterns to catch all possible import paths
  config.resolve.alias = {
    ...config.resolve.alias,
    // Directly alias the problematic file to our empty module - use absolute path
    // Match both ESM and CJS versions, with and without extensions
    '@opentelemetry/instrumentation/build/esm/instrumentationNodeModuleFile.js': emptyModulePath,
    '@opentelemetry/instrumentation/build/esm/instrumentationNodeModuleFile': emptyModulePath,
    '@opentelemetry/instrumentation/build/src/instrumentationNodeModuleFile.js': emptyModulePath,
    '@opentelemetry/instrumentation/build/src/instrumentationNodeModuleFile': emptyModulePath,
    // Also match any import that includes this filename
    'instrumentationNodeModuleFile': emptyModulePath,
    // Also ensure 'path' resolves to path-browserify in ALL contexts (including ESM)
    'path': pathBrowserify,
    'path/': pathBrowserify,
  };
  
  // Fix React Refresh runtime module resolution issue
  // The error "Cannot find module './cjs/react-refresh-runtime.development.js'" 
  // occurs when webpack can't resolve the react-refresh runtime module
  try {
    const reactRefreshPath = require.resolve('react-refresh');
    config.resolve.alias['react-refresh/runtime'] = path.join(
      path.dirname(reactRefreshPath),
      'runtime.js'
    );
  } catch (e) {
    // react-refresh not found, skip alias (shouldn't happen with react-scripts)
    console.warn('[config-overrides] react-refresh not found, skipping alias');
  }
  
  // CRITICAL: Also set resolve.extensionAlias to handle path imports in ESM modules
  config.resolve.extensionAlias = {
    ...config.resolve.extensionAlias,
    '.js': ['.js', '.ts', '.tsx'],
  };
  
  // CRITICAL: Add plugins at the BEGINNING of the plugins array
  // This ensures they run before other plugins that might try to parse the file
  config.plugins = [
    // Replace the problematic Node.js-specific file with an empty module
    // This MUST be first to intercept before webpack tries to parse
    new webpack.NormalModuleReplacementPlugin(
      /instrumentationNodeModuleFile\.js$/,
      (resource) => {
        // CRITICAL: Modify resource.request, don't return a value
        resource.request = emptyModulePath;
      }
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
    }),
    ...config.plugins,
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
