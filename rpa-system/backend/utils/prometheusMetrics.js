/**
 * Prometheus Metrics for EasyFlow
 * Business metrics exposed in Prometheus format for monitoring
 */

const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for EasyFlow

// HTTP Request Duration
const httpRequestDuration = new promClient.Histogram({
  name: 'easyflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});
register.registerMetric(httpRequestDuration);

// HTTP Request Total
const httpRequestTotal = new promClient.Counter({
  name: 'easyflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

// Active Users
const activeUsers = new promClient.Gauge({
  name: 'easyflow_active_users',
  help: 'Number of active users in the last 5 minutes',
  labelNames: ['plan']
});
register.registerMetric(activeUsers);

// Workflow Executions
const workflowExecutions = new promClient.Counter({
  name: 'easyflow_workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['status', 'trigger_type']
});
register.registerMetric(workflowExecutions);

// Workflow Execution Duration
const workflowDuration = new promClient.Histogram({
  name: 'easyflow_workflow_duration_seconds',
  help: 'Duration of workflow executions in seconds',
  labelNames: ['workflow_name'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600]
});
register.registerMetric(workflowDuration);

// Queue Stats
const queueJobsWaiting = new promClient.Gauge({
  name: 'easyflow_queue_jobs_waiting',
  help: 'Number of jobs waiting in the queue'
});
register.registerMetric(queueJobsWaiting);

const queueJobsActive = new promClient.Gauge({
  name: 'easyflow_queue_jobs_active',
  help: 'Number of jobs currently being processed'
});
register.registerMetric(queueJobsActive);

const queueJobsCompleted = new promClient.Counter({
  name: 'easyflow_queue_jobs_completed_total',
  help: 'Total number of completed jobs'
});
register.registerMetric(queueJobsCompleted);

const queueJobsFailed = new promClient.Counter({
  name: 'easyflow_queue_jobs_failed_total',
  help: 'Total number of failed jobs'
});
register.registerMetric(queueJobsFailed);

// Database Connection Pool
const dbConnectionsActive = new promClient.Gauge({
  name: 'easyflow_db_connections_active',
  help: 'Number of active database connections'
});
register.registerMetric(dbConnectionsActive);

const dbConnectionsIdle = new promClient.Gauge({
  name: 'easyflow_db_connections_idle',
  help: 'Number of idle database connections'
});
register.registerMetric(dbConnectionsIdle);

// API Response Time by Endpoint
const apiResponseTime = new promClient.Histogram({
  name: 'easyflow_api_response_time_seconds',
  help: 'API response time by endpoint',
  labelNames: ['endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});
register.registerMetric(apiResponseTime);

// Error Rate
const errorRate = new promClient.Counter({
  name: 'easyflow_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint']
});
register.registerMetric(errorRate);

// Middleware to track HTTP request metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = res.statusCode.toString();

    httpRequestDuration.observe({
      method: req.method,
      route: route,
      status_code: statusCode
    }, duration);

    httpRequestTotal.inc({
      method: req.method,
      route: route,
      status_code: statusCode
    });
  });

  next();
}

// Function to update queue metrics
function updateQueueMetrics(stats) {
  if (stats) {
    queueJobsWaiting.set(stats.waiting || 0);
    queueJobsActive.set(stats.active || 0);
  }
}

// Function to increment workflow execution counter
function recordWorkflowExecution(status, triggerType = 'manual') {
  workflowExecutions.inc({ status, trigger_type: triggerType });
}

// Function to record workflow duration
function recordWorkflowDuration(durationSeconds, workflowName = 'unknown') {
  workflowDuration.observe({ workflow_name: workflowName }, durationSeconds);
}

// Function to update active users
function updateActiveUsers(count, plan = 'unknown') {
  activeUsers.set({ plan }, count);
}

// Function to record error
function recordError(errorType, endpoint) {
  errorRate.inc({ type: errorType, endpoint });
}

// Metrics endpoint handler
async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}

// Business metrics endpoint (more detailed)
async function businessMetricsHandler(req, res) {
  const metrics = {
    timestamp: new Date().toISOString(),
    requests: {
      total: await httpRequestTotal.get(),
      duration: await httpRequestDuration.get()
    },
    workflows: {
      executions: await workflowExecutions.get(),
      duration: await workflowDuration.get()
    },
    queue: {
      waiting: queueJobsWaiting.getValue(),
      active: queueJobsActive.getValue()
    },
    errors: await errorRate.get()
  };

  res.json(metrics);
}

module.exports = {
  register,
  metricsMiddleware,
  updateQueueMetrics,
  recordWorkflowExecution,
  recordWorkflowDuration,
  updateActiveUsers,
  recordError,
  metricsHandler,
  businessMetricsHandler,
  // Expose individual metrics for direct manipulation
  httpRequestDuration,
  httpRequestTotal,
  workflowExecutions,
  workflowDuration,
  queueJobsWaiting,
  queueJobsActive,
  queueJobsCompleted,
  queueJobsFailed,
  activeUsers,
  errorRate
};
