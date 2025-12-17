# 📘 Project Best Practices

## 1. Project Purpose
Easy-Flow is a multi-service RPA platform focused on running and monitoring automation workflows. It provides a Node.js backend (Express) for APIs, a React-based dashboard (rpa-dashboard), an automation service (Python) for web automation, and an observability stack (Prometheus, Grafana, Loki/Tempo, OpenTelemetry) for metrics, logs, and traces. Kafka is used for asynchronous eventing/work dispatch.

## 2. Project Structure
- Root
  - rpa-system/
    - backend/ (Node.js Express API, business logic, instrumentation)
      - app.js/server.js entrypoints
      - middleware/ (telemetry, tracing, structured logging, auth/plan enforcement, performance)
      - routes/ (HTTP route handlers grouped by domain)
      - services/ (business logic and integrations)
      - utils/ (logging, supabase client, kafka, metrics)
      - tests/ (Jest tests and setup)
      - monitoring/ (Prometheus config specific to backend)
    - automation/automation-service/ (Python workers for automation)
      - *.py scripts and requirements.txt
    - monitoring/ (docker-compose + configs for Prometheus, Loki, Tempo, OTEL collector, Promtail, Grafana)
  - rpa-dashboard/ (frontend dashboard)
  - kafka-clients/ (Node/Python Kafka client examples)
  - scripts/ (devops and helper scripts: deploy, analyze, generate env, etc.)
  - k8s/ (k8s manifests)
  - docker-compose.yml, docker-compose.monitoring.yml (service orchestration)
  - OBSERVABILITY.md (setup notes for telemetry stack)

Key entry points and configs
- Backend runtime: rpa-system/backend/server.js (full) and server_fast.js/minimal_server.js for lighter boot
- Backend app composition: rpa-system/backend/app.js/app_fast.js
- Observability configs: rpa-system/monitoring/* (Prometheus, Loki, Tempo, OTEL Collector, Promtail)
- Telemetry bootstrap: rpa-system/backend/middleware/telemetryInit.js
- Environment: .env files (root and backend), .env.example templates

## 3. Test Strategy
- Framework: Jest (configured in rpa-system/backend)
  - Config: rpa-system/backend/jest.config.js
  - Tests under: rpa-system/backend/tests/**/*.test.js
  - Setup file: rpa-system/backend/tests/jest.setup.js
- Mocking guidelines
  - Use the provided Jest setup which mocks:
    - @supabase/supabase-js (createClient)
    - axios HTTP client
    - firebase utils (firebaseNotificationService)
    - kafkaService (getKafkaService)
  - Avoid real network/kafka/db in unit tests; rely on chainable query stubs provided by jest.setup.js.
- Running tests
  - In backend: npm run test:backend (delegates to jest)
  - Prefer running in-band for deterministic behavior in CI.
- Philosophy
  - Unit-test services, utils, and route handlers with mocked I/O.
  - Integration tests are optional; if added, isolate external dependencies behind interfaces and mock at the boundary.
  - Keep tests fast and deterministic; do not depend on real external infrastructure.

## 4. Code Style
- Language & modules
  - Node.js (CommonJS) in backend; Python in automation service; TypeScript appears only in some controller files (transpile if needed by existing tooling).
- Async/await
  - Prefer async/await with try/catch for error paths. Avoid mixing callbacks and promises.
- Logging
  - Use structured logging via middleware/structuredLogging.js and utils/logger.js (getLogger(namespace)).
  - Do not use console.log/console.error in application code; route logs through the structured logger for correlation with traces.
- Tracing & metrics
  - Initialize OpenTelemetry early (server.js/app.js) using middleware/telemetryInit.js.
  - Do not capture Authorization headers in spans; rely on provided instrumentation config.
  - Use recordSLOMetric or global.sloMetrics for domain metrics when appropriate.
- Naming
  - Files: kebabCase or camelCase for JS files; descriptors like routes/, services/, utils/, middleware/ denote roles.
  - Functions/variables: camelCase; classes: PascalCase.
  - Route modules end with Routes (e.g., socialProofRoutes.js). Services end with Service (e.g., dataRetentionService.js) or clearly describe capability.
- Comments & docs
  - Keep comments high-signal; avoid restating code. Prefer module-level comments for complex flows and public interfaces.
- Error handling
  - Map internal errors to consumer-friendly messages where applicable (utils/consumerErrorMessages).
  - Set SpanStatusCode and add attributes to spans on error paths (where tracing is used).
  - Ensure HTTP routes return consistent JSON error shape and appropriate status codes.
- Configuration
  - Use .env with dotenv; prefer reading once in early bootstrap. Do not commit secrets.
  - Use feature flags/plan enforcement via middleware/planEnforcement.js and services/planService.js.

## 5. Common Patterns
- Layered backend
  - routes/ -> services/ -> utils/ (separation of HTTP concerns, business logic, infrastructure)
- Instrumentation wrappers
  - createInstrumentedSupabaseClient (databaseInstrumentation)
  - createInstrumentedHttpClient (httpInstrumentation)
  - performance spans via performanceInstrumentation
- Structured logging with trace context
  - traceContext middleware provides per-request context and createContextLogger
- Observability-first
  - telemetryInit configures OTLP exporters, Prometheus exporter with guarded startup, and sensitive data redaction on spans
- Worker and async patterns
  - workers/ for background processes; Kafka utils with fallback to REST when Kafka unavailable
- Configuration through environment
  - Prefer OTEL_* variables for telemetry endpoints; support Grafana Cloud format via OTEL_RESOURCE_ATTRIBUTES

## 6. Do's and Don'ts
- ✅ Do
  - Use getLogger/createLogger for all logs and include a clear namespace
  - Add/propagate trace context within route handlers and external calls
  - Validate and sanitize inputs in routes/services
  - Handle and log errors with sufficient context; map to safe client messages
  - Keep business logic in services; routes should be thin
  - Mock external dependencies in unit tests; keep tests hermetic
  - Use environment variables for configuration; provide defaults for local dev
  - Keep automation workers idempotent and resilient to retries
- ❌ Don’t
  - Don’t use console.log/console.error in backend code
  - Don’t leak secrets in logs, spans, or errors
  - Don’t make network or DB calls directly in tests
  - Don’t couple routes directly to external SDKs without wrappers
  - Don’t block the event loop with long-running synchronous work

## 7. Tools & Dependencies
- Backend (Node.js)
  - express: HTTP server
  - @opentelemetry/*: tracing/metrics auto-instrumentations + OTLP/Prometheus exporters
  - pino: structured logging
  - @supabase/supabase-js: database and auth client
  - axios: HTTP client
  - jest/babel-jest: testing + transforms; jest.setup.js provides mocks
  - redis, kafkajs: caching/queueing (optional per deployment)
- Automation (Python)
  - Requirements in rpa-system/automation/automation-service/requirements.txt
- Observability
  - Prometheus, Grafana, Loki, Tempo, OTEL Collector, Promtail
  - Configs under rpa-system/monitoring/
- Setup (backend)
  - cd rpa-system/backend && npm install
  - npm run test:backend to run Jest tests
  - Start server via server.js or minimal_server.js for local verification
- Monitoring stack
  - docker-compose.monitoring.yml and start-observability.sh under rpa-system/monitoring

## 8. Other Notes
- Multi-repo-in-one: Node backend, Python automation, frontend dashboard, and infra tooling coexist—keep changes scoped and language-idiomatic per folder.
- Telemetry safeguards
  - telemetryInit includes header sanitization, exporter error handling, selective instrumentation, and sensitive data redaction. Preserve these patterns when extending.
- Environment
  - Use .env.example templates when adding new variables; prefer feature flags for behavior changes.
- Testing new modules
  - Place unit tests under rpa-system/backend/tests with .test.js suffix
  - Use provided mocks; extend the jest.setup.js stubs if a new service is introduced
- Logging consistency
  - Ensure any new module uses utils/logger or middleware/structuredLogging to inherit context (trace ids) and output format.
