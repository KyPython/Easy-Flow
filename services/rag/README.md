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

Production deployment
 - CI will build and push a Docker image for `services/rag`. See `.github/workflows/deploy-rag.yml`.
 - To deploy using the provided production compose file, place `docker-compose.prod.yml` on your host and set `DOCKER_REGISTRY` and `TAG` environment variables, then:

```bash
export DOCKER_REGISTRY=registry.example.com/yourorg
export TAG=sha-or-tag
docker pull ${DOCKER_REGISTRY}/easyflow-rag:${TAG}
docker-compose -f docker-compose.prod.yml up -d
```

The CI workflow includes an optional SSH deploy step that expects these secrets: `DOCKER_REGISTRY`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, and `DEPLOY_PATH`.
