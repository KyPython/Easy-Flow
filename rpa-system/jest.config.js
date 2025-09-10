module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,jsx}',
    '<rootDir>/rpa-dashboard/src/**/*.test.{js,jsx}',
    '<rootDir>/backend/tests/**/*.test.js'
  ],

  // Module name mapping
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub',
    '^@/(.*)$': '<rootDir>/rpa-dashboard/src/$1',
    '^@components/(.*)$': '<rootDir>/rpa-dashboard/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/rpa-dashboard/src/utils/$1',
  },

  // Transform patterns
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },

  transformIgnorePatterns: [
    'node_modules/(?!(axios|@supabase/supabase-js)/)'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'rpa-dashboard/src/**/*.{js,jsx}',
    'backend/**/*.js',
    '!rpa-dashboard/src/**/*.test.{js,jsx}',
    '!backend/tests/**/*.js',
    '!rpa-dashboard/src/index.js',
    '!rpa-dashboard/src/reportWebVitals.js'
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Setup files to handle global polyfills
  setupFiles: ['<rootDir>/tests/jest.setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/'
  ],

  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true
};
