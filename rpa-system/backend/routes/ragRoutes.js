/**
 * RAG Service Routes
 *
 * Provides endpoints for RAG service health checks and management
 * These endpoints allow EasyFlow to check RAG service status and manage knowledge
 */

const express = require('express');
const router = express.Router();
const { createLogger } = require('../middleware/structuredLogging');
const { contextLoggerMiddleware } = require('../middleware/traceContext');
const { authMiddleware } = require('../middleware/auth');

const logger = createLogger('rag.routes');
const ragClient = require('../services/ragClient');

/**
 * GET /api/rag/health
 * Check RAG service health status
 */
router.get('/health', authMiddleware, contextLoggerMiddleware, async (req, res) => {
 try {
 const health = await ragClient.healthCheck();

 res.json({
 success: health.success,
 status: health.status,
 timestamp: health.timestamp,
 serviceUrl: ragClient.RAG_SERVICE_URL,
 message: health.success
 ? 'RAG service is healthy'
 : `RAG service unavailable: ${health.error || 'unknown error'}`
 });
 } catch (error) {
 logger.error('RAG health check failed', error);
 res.status(500).json({
 success: false,
 status: 'error',
 error: error.message,
 serviceUrl: ragClient.RAG_SERVICE_URL
 });
 }
});

/**
 * POST /api/rag/seed
 * Seed the RAG knowledge base with EasyFlow knowledge
 * Admin-only endpoint
 */
router.post('/seed', authMiddleware, contextLoggerMiddleware, async (req, res) => {
 try {
 const aiAgent = require('../services/aiWorkflowAgent');
 
 if (!aiAgent || typeof aiAgent.initializeKnowledge !== 'function') {
 throw new Error('AI Agent service not fully initialized');
 }
 
 const result = await aiAgent.initializeKnowledge();

 res.json({
 success: result.success,
 method: result.method,
 successCount: result.successCount,
 errorCount: result.errorCount,
 message: result.message || (result.success ? 'Knowledge seeded successfully' : 'Failed to seed knowledge')
 });
 } catch (error) {
 logger.error('RAG seed failed', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

/**
 * POST /api/rag/ingest
 * Ingest custom knowledge into RAG service
 * Admin-only endpoint
 */
router.post('/ingest', authMiddleware, contextLoggerMiddleware, async (req, res) => {
 try {
 const { text, source, metadata } = req.body;

 if (!text || typeof text !== 'string') {
 return res.status(400).json({
 success: false,
 error: 'text field is required and must be a string'
 });
 }

 if (!source || typeof source !== 'string') {
 return res.status(400).json({
 success: false,
 error: 'source field is required and must be a string'
 });
 }

 const result = await ragClient.ingestText(text, source, metadata || {});

 res.json({
 success: result.success,
 chunksProcessed: result.chunksProcessed,
 source: result.source,
 error: result.error
 });
 } catch (error) {
 logger.error('RAG ingest failed', error);
 res.status(500).json({
 success: false,
 error: error.message
 });
 }
});

module.exports = router;
