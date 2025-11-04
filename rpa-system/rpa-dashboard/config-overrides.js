/*
 * PERFORMANCE OPTIMIZATION: Webpack Build Configuration
 *
 * CHANGES MADE:
 * 1. Optimized code splitting for vendor, common, and feature chunks
 * 2. Added production-only optimizations (minification, tree-shaking)
 * 3. Configured performance budgets to prevent bundle bloat
 * 4. Added chunk naming for better caching
 *
 * IMPACT: Reduces production bundle size and improves caching strategy
 */

const webpack = require('webpack');

module.exports = function override(config, env) {
  // ============================================================================
  // Node.js Polyfills for Browser Compatibility (Optional - fallback to false if not available)
  // ============================================================================
  const tryResolve = (moduleName) => {
    try {
      return require.resolve(moduleName);
    } catch (e) {
      return false;
    }
  };

  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    path: tryResolve('path-browserify') || false,
    stream: tryResolve('stream-browserify') || false,
    buffer: tryResolve('buffer') || false,
    zlib: tryResolve('browserify-zlib') || false,
    util: tryResolve('util') || false,
    process: tryResolve('process/browser.js') || false,
  };

  // ============================================================================
  // Global Polyfill Providers (Only if modules are available)
  // ============================================================================
  const providePlugins = {};
  if (config.resolve.fallback.process) {
    providePlugins.process = 'process/browser.js';
  }
  if (config.resolve.fallback.buffer) {
    providePlugins.Buffer = ['buffer', 'Buffer'];
  }

  if (Object.keys(providePlugins).length > 0) {
    config.plugins = [
      ...(config.plugins || []),
      new webpack.ProvidePlugin(providePlugins),
    ];
  }

  // ============================================================================
  // Code Splitting Optimization
  // Split vendor code, common code, and feature-specific chunks
  // ============================================================================
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: Infinity,
      minSize: 20000, // 20kb minimum chunk size
      cacheGroups: {
        // Vendor chunk - all node_modules
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          reuseExistingChunk: true,
        },
        // React ecosystem chunk (React, React-DOM, React-Router)
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom|prop-types)[\\/]/,
          name: 'react-vendor',
          priority: 20,
          reuseExistingChunk: true,
        },
        // Workflow builder chunk (lazy-loaded feature)
        workflow: {
          test: /[\\/]src[\\/]components[\\/]WorkflowBuilder[\\/]/,
          name: 'workflow',
          priority: 15,
          minChunks: 1,
          reuseExistingChunk: true,
        },
        // Common code used across multiple chunks
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          name: 'common',
        },
      },
    },
    // Better chunk IDs for caching
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
  };

  // ============================================================================
  // Production-Only Optimizations
  // ============================================================================
  if (env === 'production') {
    // Minification optimization
    if (config.optimization.minimizer && config.optimization.minimizer[0]) {
      const terserPlugin = config.optimization.minimizer[0];
      if (terserPlugin.options && terserPlugin.options.terserOptions) {
        terserPlugin.options.terserOptions.compress = {
          ...terserPlugin.options.terserOptions.compress,
          drop_console: true, // Remove console.log in production
          drop_debugger: true,
          pure_funcs: ['console.info', 'console.debug', 'console.warn'],
        };
      }
    }

    // Performance budgets - warn if bundles exceed limits
    config.performance = {
      maxEntrypointSize: 512000, // 500kb
      maxAssetSize: 512000, // 500kb
      hints: 'warning',
    };
  }

  // ============================================================================
  // Output Configuration for Better Caching
  // ============================================================================
  if (env === 'production') {
    config.output = {
      ...config.output,
      filename: 'static/js/[name].[contenthash:8].js',
      chunkFilename: 'static/js/[name].[contenthash:8].chunk.js',
    };
  }

  return config;
};

