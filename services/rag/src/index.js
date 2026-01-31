require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const bouncer = require('./bouncer');
const { evaluate } = require('./judge');
const { sendTrace } = require('./langsmith');

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ok:true, service:'easyflow-rag'}));

app.post('/query', async (req, res) => {
  const { query } = req.body || {};
  const requestId = uuidv4();
  logger.info({requestId, query}, 'incoming_query');

  const intent = bouncer.checkIntent(query);
  if (!intent.allowed) {
    logger.warn({requestId, reason:intent.reason}, 'bouncer_rejected');
    return res.status(400).json({requestId, error: 'blocked', reason: intent.reason});
  }

  // TODO: Replace with real retrieval from Chroma/Vector DB
  const fakeSources = [];

  // TODO: Replace with real LLM call (Azure/OpenAI) via factory pattern
  const generated = `Stubbed answer for: ${query}`;

  // Send LangSmith trace asynchronously
  sendTrace({ requestId, query, sources: fakeSources, generated }).catch(()=>{});

  logger.info({requestId, answer: generated, sourcesCount: fakeSources.length}, 'answer_ready');
  return res.json({ requestId, answer: generated, sources: fakeSources, cost: 0 });
});

app.post('/evaluate', (req, res) => {
  const { generated, sources, query, expected } = req.body || {};
  const requestId = uuidv4();
  const scores = evaluate({ generated: generated || '', sources: sources || [], query: query || '', expected });
  logger.info({requestId, scores}, 'evaluation');
  res.json({ requestId, scores });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info({port:PORT}, 'easyflow-rag-listening');
});
