const path = require('path');

module.exports = function override(config, env) {
  // Add support for absolute imports
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, 'rpa-dashboard/src'),
    '@components': path.resolve(__dirname, 'rpa-dashboard/src/components'),
    '@utils': path.resolve(__dirname, 'rpa-dashboard/src/utils'),
    '@assets': path.resolve(__dirname, 'rpa-dashboard/src/assets'),
  };

  // Configure test environment
  if (env === 'test') {
    config.testEnvironment = 'jsdom';
    
    // Set up test files pattern
    config.testMatch = [
      '<rootDir>/tests/**/*.test.{js,jsx}',
      '<rootDir>/rpa-dashboard/src/**/*.test.{js,jsx}',
      '<rootDir>/backend/tests/**/*.test.js'
    ];

    // Configure setupFiles
    config.setupFilesAfterEnv = config.setupFilesAfterEnv || [];
    config.setupFilesAfterEnv.push('<rootDir>/tests/setup.js');

    // Module name mapping for CSS and assets
    config.moduleNameMapper = {
      ...config.moduleNameMapper,
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub',
      '^@/(.*)$': '<rootDir>/rpa-dashboard/src/$1',
      '^@components/(.*)$': '<rootDir>/rpa-dashboard/src/components/$1',
    };

    // Transform ignore patterns
    config.transformIgnorePatterns = [
      'node_modules/(?!(axios|@supabase/supabase-js)/)'
    ];
  }

  return config;
};
