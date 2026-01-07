# RAG Integration - Full Implementation Guide

##  Integration Status

EasyFlow now has **full integration** with the `rag-node-ts` RAG service for knowledge-powered AI assistance.

---

## 📦 What's Integrated

### 1.  RAG Client (`rpa-system/backend/services/ragClient.js`)
- **Query**: Retrieve relevant knowledge passages or full RAG answers
- **Ingest**: Add new knowledge to the RAG knowledge base
- **Batch Ingest**: Bulk knowledge ingestion
- **Health Check**: Verify RAG service availability
- **Clear Namespace**: Reset knowledge base (for re-indexing)
- **Seed Knowledge**: Pre-populate with EasyFlow app knowledge

### 2.  AI Workflow Agent Integration (`rpa-system/backend/services/aiWorkflowAgent.js`)
- Uses RAG for knowledge retrieval in workflow generation
- Uses RAG for conversation responses
- Automatically seeds knowledge on initialization
- Gracefully handles RAG service unavailability

### 3.  Backend Routes (`rpa-system/backend/routes/ragRoutes.js`)
- `GET /api/rag/health` - Check RAG service health
- `POST /api/rag/seed` - Seed knowledge base
- `POST /api/rag/ingest` - Ingest custom knowledge

### 4.  Automatic Knowledge Seeding
- Knowledge base is automatically seeded on backend startup
- Includes comprehensive EasyFlow app knowledge:
  - Workflow steps and configuration
  - Task configuration guides
  - App features and navigation
  - Troubleshooting guides
  - Integration information
  - New features (2025)

### 5.  Integration Knowledge (`rpa-system/backend/services/addIntegrationKnowledge.js`)
- Automatically adds integration knowledge (Slack, Gmail, Google Sheets, etc.)
- Called during knowledge initialization

---

##  Configuration

### Environment Variables

Add these to your `rpa-system/backend/.env`:

```bash
# RAG Service Configuration
RAG_SERVICE_URL=http://localhost:3001  # URL of rag-node-ts service
RAG_API_KEY=sk_rag_easyflow_dev        # API key for authentication
RAG_TIMEOUT=30000                      # Request timeout in ms (default: 30000)
RAG_AUTO_SEED=true                     # Auto-seed knowledge on startup (default: true)
```

### RAG Service Setup

1. **Start the RAG service** (from `/Users/ky/rag-node-ts`):
   ```bash
   cd /Users/ky/rag-node-ts
   npm install
   npm run build
   npm run dev
   ```

2. **Configure RAG service** (in `rag-node-ts/.env`):
   ```bash
   OPENAI_API_KEY=your_openai_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX_NAME=your_index_name
   RAG_API_KEY=sk_rag_easyflow_dev  # Must match RAG_API_KEY in EasyFlow backend
   PORT=3001
   ```

3. **Verify connection**:
   ```bash
   curl http://localhost:3001/health
   ```

---

##  Usage

### Automatic (Recommended)

Knowledge is automatically seeded on backend startup. No manual action required.

### Manual Knowledge Seeding

If you need to manually seed or re-seed knowledge:

```bash
# Via API endpoint (requires authentication)
curl -X POST http://localhost:3030/api/rag/seed \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or via AI Agent endpoint
curl -X POST http://localhost:3030/api/ai-agent/initialize-knowledge \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check RAG Service Health

```bash
curl http://localhost:3030/api/rag/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ingest Custom Knowledge

```bash
curl -X POST http://localhost:3030/api/rag/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your knowledge content here...",
    "source": "custom:knowledge:source",
    "metadata": {
      "category": "custom",
      "version": "1.0"
    }
  }'
```

---

## 📚 Knowledge Base Contents

The RAG knowledge base includes:

### Workflow Steps
- Start, End, Web Scraping, API Request, Transform Data, Condition, Send Email, Delay, Upload File

### Task Configuration
- Invoice Download configuration
- Web Scraping configuration
- Form Submission configuration
- AI Extraction setup
- Link Discovery usage

### App Features
- Workflow Builder usage
- Scheduling workflows
- Templates
- File Management
- Business Rules
- Bulk Processing
- Analytics
- Integrations

### Troubleshooting
- Workflow troubleshooting
- Task troubleshooting
- Error handling guides

### New Features (2025)
- Bookmarklet for vendor portals
- Auto-scroll and smart navigation
- Plain English UI
- AI-powered data extraction
- Improved link discovery
- Enhanced error handling

### Integrations
- Slack, Gmail, Google Sheets, Google Meet, WhatsApp
- OAuth setup
- Multi-channel collection

---

##  How It Works

### 1. Query Flow
```
User Query -> AI Agent -> RAG Client -> rag-node-ts Service -> Pinecone -> OpenAI Embeddings
                                                                    ↓
User Response ← AI Agent ← Enhanced Context ← Retrieved Passages ← Vector Search
```

### 2. Ingestion Flow
```
Knowledge Text -> RAG Client -> rag-node-ts Service -> Text Chunking -> OpenAI Embeddings -> Pinecone
```

### 3. Startup Flow
```
Backend Startup -> Database Warm-up -> RAG Auto-Seed (async) -> Server Ready
                                              ↓
                                    Check RAG Health
                                              ↓
                                    Seed EasyFlow Knowledge
                                              ↓
                                    Seed Integration Knowledge
```

---

## 🛠️ Development

### Testing RAG Integration

1. **Start RAG service**:
   ```bash
   cd /Users/ky/rag-node-ts
   npm run dev
   ```

2. **Start EasyFlow backend**:
   ```bash
   cd /Users/ky/Easy-Flow/rpa-system/backend
   npm run dev
   ```

3. **Check logs** for RAG initialization:
   ```
   [server] 🧠 Initializing RAG knowledge base...
   [server]  RAG knowledge base initialized
   ```

4. **Test AI Agent** with a query that should use RAG knowledge:
   ```
   "How do I configure an invoice download task?"
   ```

### Disabling RAG (for testing)

Set `RAG_AUTO_SEED=false` in `.env` to skip automatic seeding on startup.

---

##  Monitoring

### Health Checks

- **RAG Service Health**: `GET /api/rag/health`
- **Knowledge Status**: `GET /api/ai-agent/knowledge-status`

### Logs

RAG operations are logged with structured logging:
- `ai.rag.query` - Query operations
- `ai.rag.ingest` - Ingestion operations
- `ai.rag.health` - Health checks

### Metrics

RAG performance metrics are tracked:
- Query latency
- Cache hit rate
- Ingestion throughput
- Error rates

---

## 🔐 Security

- **API Key Authentication**: All RAG service requests require API key
- **Tenant Isolation**: Multi-tenant support via namespaces
- **Rate Limiting**: Built into rag-node-ts service
- **Input Validation**: All inputs validated before processing

---

## 🐛 Troubleshooting

### RAG Service Not Available

**Symptoms**: AI Agent works but with limited knowledge, warnings in logs

**Solution**:
1. Check if RAG service is running: `curl http://localhost:3001/health`
2. Verify `RAG_SERVICE_URL` in backend `.env`
3. Verify `RAG_API_KEY` matches in both services
4. Check RAG service logs for errors

### Knowledge Not Seeding

**Symptoms**: No knowledge in RAG, AI responses lack context

**Solution**:
1. Check backend logs for RAG initialization errors
2. Manually trigger seeding: `POST /api/rag/seed`
3. Verify RAG service is accessible from backend
4. Check Pinecone index is configured correctly

### Slow RAG Queries

**Symptoms**: AI responses are slow

**Solution**:
1. Check RAG service performance
2. Verify caching is enabled (`useCache: true`)
3. Check Pinecone index performance
4. Consider increasing `RAG_TIMEOUT` if needed

---

## 📝 API Reference

### RAG Client Methods

```javascript
const ragClient = require('./services/ragClient');

// Query for knowledge
const result = await ragClient.query('How do I create a workflow?', {
  topK: 5,
  mode: 'retrieval', // or 'answer'
  useCache: true
});

// Ingest knowledge
await ragClient.ingestText('Knowledge content...', 'source:name', { metadata });

// Batch ingest
await ragClient.ingestBatch([
  { text: 'Content 1', source: 'source1' },
  { text: 'Content 2', source: 'source2' }
]);

// Health check
const health = await ragClient.healthCheck();

// Seed EasyFlow knowledge
await ragClient.seedEasyFlowKnowledge();
```

---

##  Next Steps

1. **Monitor RAG Usage**: Track query patterns to improve knowledge base
2. **Expand Knowledge**: Add more app-specific knowledge as features grow
3. **Optimize Performance**: Fine-tune chunking and retrieval parameters
4. **User Feedback**: Use feedback to improve knowledge relevance

---

## 📖 Related Documentation

- [rag-node-ts README](/Users/ky/rag-node-ts/README.md)
- [AI Workflow Agent](./AI_WORKFLOW_AGENT.md)
- [Integration Knowledge](./INTEGRATIONS.md)

---

**Last Updated**: 2025-01-XX
**Status**:  Fully Integrated

