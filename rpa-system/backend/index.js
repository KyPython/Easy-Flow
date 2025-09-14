// Backward-compatible entrypoint for environments expecting backend/index.js
// Delegates to server.js which boots the Express app.
require('./server');
