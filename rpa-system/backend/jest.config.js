module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Setup file to run before each test suite - we'll stub external services here
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  transform: {
    // Use babel-jest for any files using import syntax if present
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'json', 'jsx', 'node']
};
