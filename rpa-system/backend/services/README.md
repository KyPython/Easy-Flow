# Services Directory

**Purpose:** Contains all business logic services. Services handle core application functionality.

## Core Services

| Service | Purpose | Used By |
|---------|---------|---------|
| `workflowExecutor.js` | Execute workflows | `executionRoutes.js`, `workflowRoutes.js` |
| `aiWorkflowAgent.js` | AI workflow generation | `aiAgentRoutes.js` |
| `executionModeService.js` | Execution mode logic (real-time, eco, balanced) | `workflowExecutor.js` |
| `smartScheduler.js` | Workflow scheduling | `scheduleRoutes.js` |
| `integrationFramework.js` | Integration management | `integrationRoutes.js` |

## Feature Services

| Service | Purpose | Used By |
|---------|---------|---------|
| `linkDiscoveryService.js` | Discover PDF links | `scrapingRoutes.js` |
| `aiDataExtractor.js` | AI data extraction | `scrapingRoutes.js` |
| `jobParserService.js` | Job parsing | Various |
| `leadScoringService.js` | Lead scoring | Various |
| `companyEnrichmentService.js` | Company data enrichment | Various |
| `contactEnrichmentService.js` | Contact data enrichment | Various |

## Utility Services

| Service | Purpose | Used By |
|---------|---------|---------|
| `planService.js` | Plan management | Various |
| `userPlanResolver.js` | Resolve user plans | `planEnforcement.js` |
| `metricsCacheService.js` | Metrics caching | Analytics routes |
| `workflowMetrics.js` | Workflow metrics | Analytics routes |
| `costSavingsCalculator.js` | Cost savings calculation | Analytics routes |

## Integration Services

Located in `services/integrations/`:
- Individual integration implementations
- Each integration has its own service file

## Service Pattern

Each service typically:
1. Exports functions (not classes)
2. Uses structured logging via `createLogger()`
3. Handles errors gracefully
4. Returns consistent data structures

Example:
```javascript
const { createLogger } = require('../middleware/structuredLogging');
const logger = createLogger('serviceName');

async function doSomething(data) {
 try {
 logger.info('Doing something', { data });
 // Service logic
 return result;
 } catch (error) {
 logger.error('Failed to do something', { error, data });
 throw error;
 }
}

module.exports = { doSomething };
```

## Finding Services

1. Check route files - they import services
2. Search for service name in `services/` directory
3. Check service README.md if available

## Adding a New Service

1. Create `newService.js` in this directory
2. Export functions
3. Use structured logging
4. Import and use in routes or other services
