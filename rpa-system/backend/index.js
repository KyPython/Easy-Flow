<<<<<<< HEAD
// Backward-compatible entrypoint for environments expecting backend/index.js
// Export the Express app for test harnesses and require server bootstrap.
const app = require('./app');
// Start server only when executed directly
require('./server');

module.exports = app;
=======
require('./server');
>>>>>>> restored-37cdb23
