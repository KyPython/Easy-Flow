const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));
 
// In-memory store for captured emails during testing
let capturedEmails = [];
 
// This endpoint is called by the email_worker during tests, mocking the real /api/send-email-now
app.post('/api/send-email-now', (req, res) => {
  // Use structured logging for better readability and to avoid overly long log lines.
  console.log('[hooks_probe] Received email webhook:', {
    to: req.body.to_email,
    template: req.body.template,
    hasData: !!req.body.data,
    authHeader: req.headers['authorization'] ? 'Present' : 'Missing',
  });
  capturedEmails.push(req.body);
  res.json({ ok: true, message: 'Email captured by test probe.' });
});
 
// Test-only endpoint to retrieve captured emails
app.get('/test/emails', (req, res) => {
  res.json(capturedEmails);
});
 
// Test-only endpoint to clear captured emails for a clean test state
app.delete('/test/emails', (req, res) => {
  capturedEmails = [];
  res.status(204).send();
});

app.get('/health', (req, res) => res.send('ok'));

const port = 4001; // Always use 4001 for the probe
const server = app.listen(port, '0.0.0.0', () => console.log(`hooks_probe listening on ${port}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[hooks_probe] Error: Port ${port} is already in use. Please find and stop the other process or choose a different port.`);
    process.exit(1);
  } else {
    console.error('An unhandled server error occurred:', err);
  }
});
