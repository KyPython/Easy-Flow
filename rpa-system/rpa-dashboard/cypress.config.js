const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    video: false,
    defaultCommandTimeout: 10000,
    supportFile: 'cypress/support/e2e.js'
  }
});
