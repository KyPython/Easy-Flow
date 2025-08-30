const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for Node built-ins
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    net: false,
    tls: false,
    path: require.resolve('path-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    zlib: require.resolve('browserify-zlib'),
    util: require.resolve('util'),
    process: require.resolve('process/browser.js'), // must include .js
  };

  // Provide polyfills globally
  config.plugins = [
    ...(config.plugins || []),
    new webpack.ProvidePlugin({
      process: 'process/browser.js', // must include .js
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  return config;
};

