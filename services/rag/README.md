# EasyFlow RAG microservice

This is a minimal RAG service scaffold used by EasyFlow. It includes:

- Moderation gateway (bouncer) to filter intents and basic jailbreak attempts
- Structured logging with `pino`
- A simple `/evaluate` endpoint implementing the RAG Triad (stubbed)
- Dockerfile for local development

To run locally:

```
cd services/rag
npm install
npm run start
```
