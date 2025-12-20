module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Always load .env before running tests
  // setupFiles: ['<rootDir>/tests/jest.env-setup.js'],
  // Setup file to run before each test suite - we'll stub external services here
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  transform: {
    // Use babel-jest for any files using import syntax if present
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
  // Allow tests to pass when no test files are found (useful during development)
  passWithNoTests: true,
  // Increase timeout for tests that may need more time (e.g., database queries, async operations)
  testTimeout: 30000  // 30 seconds (default is 5 seconds)
};
