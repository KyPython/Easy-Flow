
const { logger, getLogger } = require('./utils/logger');
// Minimal server for social proof development
const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables (if any)
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3030;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'https://easy-flow-lac.vercel.app'],
  credentials: true
}));

app.use(express.json());

// Serve static demo file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'social-proof.html'));
});

// Demo page route
app.get('/demo/social-proof', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'social-proof.html'));
});

// Social proof routes
const socialProofRoutes = require('./routes/socialProofRoutes');
app.use('/api', socialProofRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal server with social proof running' });
});

// Fallback for other API routes (return 404 instead of crashing)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not implemented in minimal server' });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`🚀 Minimal server running on port ${PORT}`);
  logger.info(`📊 Social proof API: http://localhost:${PORT}/api/social-proof-metrics`);
  logger.info(`🎨 Demo page: http://localhost:${PORT}/demo/social-proof`);
});