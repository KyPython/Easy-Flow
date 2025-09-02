const path = require('path');

module.exports = {
  // Set the root directory to the project root (one level up from `backend`).
  // This is crucial so that Jest can find the root `babel.config.js` and `node_modules`.
  rootDir: path.join(__dirname, '..'),

  // Setup files to run before tests
  setupFiles: [
    '<rootDir>/backend/setup-tests.js'
  ],

  // Now that rootDir is set, we must specify the test paths relative to it.
  testMatch: [
    '<rootDir>/backend/tests/**/*.test.js'
  ],

  // Specifies the test environment as Node.js, which is required for backend tests.
  testEnvironment: 'node',

  // Increases the default timeout to 30 seconds to allow for async operations
  // like database queries and API calls to complete.
  testTimeout: 30000,

  // The transform configuration to tell Jest to use `babel-jest`.
  // It will now correctly find and use the root `babel.config.js`.
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
};