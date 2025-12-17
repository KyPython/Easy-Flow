
const { logger, getLogger } = require('./utils/logger');
// Minimal test server to check if basic Express setup works
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
// ✅ SECURITY: Disable X-Powered-By header
app.disable('x-powered-by');
const PORT = process.env.PORT || 3030;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

// API routes that the frontend is trying to reach
app.get('/api/social-proof-metrics', (req, res) => {
  res.json({ 
    metrics: {
      totalUsers: 1000,
      activeToday: 50,
      conversions: 25
    }
  });
});

app.post('/api/track-event', (req, res) => {
  logger.info('Track event:', req.body);
  res.json({ success: true });
});

app.post('/api/trigger-campaign', (req, res) => {
  logger.info('Trigger campaign:', req.body);
  res.json({ success: true, campaignId: 'test-123' });
});

app.get('/api/user/plan', (req, res) => {
  res.json({ 
    plan: 'free',
    features: ['basic-automation', 'limited-workflows'],
    usage: { workflows: 5, max: 10 }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`✅ Minimal backend server running on http://localhost:${PORT}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
});