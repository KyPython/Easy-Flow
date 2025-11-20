
const { logger, getLogger } = require('./utils/logger');
// Fast loading version of app.js - skip problematic modules
const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3030;

// Enable CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://easy-flow-lac.vercel.app'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(), 
    service: 'backend-fast', 
    build: process.env.BUILD_ID || 'dev' 
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(), 
    service: 'backend-fast', 
    build: process.env.BUILD_ID || 'dev' 
  });
});

// Load only essential routes that don't have heavy dependencies
try {
  const socialProofRoutes = require('./routes/socialProofRoutes');
  app.use('/api', socialProofRoutes);
  logger.info('✓ Social proof routes loaded');
} catch (e) {
  logger.info('⚠️ Social proof routes failed:', e.message);
}

// Basic API endpoints
app.get('/api/workflows', (req, res) => {
  res.json({ workflows: [], message: 'Workflow service initializing...' });
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: [], message: 'Task service initializing...' });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

module.exports = app;