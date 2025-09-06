/**
 * K6 Load Test for EasyFlow API
 * Tests basic API endpoints under increasing load
 * 
 * Usage:
 *   k6 run --env BACKEND_URL=http://localhost:3030 basic-load-test.k6.js
 *   k6 run --env BACKEND_URL=http://staging-url:3030 basic-load-test.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const requestCounter = new Counter('total_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users  
    { duration: '2m', target: 25 },  // Ramp up to 25 users
    { duration: '5m', target: 25 },  // Stay at 25 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests must complete below 1.5s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BACKEND_URL || 'http://localhost:3030';

// Test user credentials (you may need to create these in your test environment)
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD || 'LoadTest123!';

let authToken = null;

export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  
  // Try to authenticate (optional - remove if you don't have auth set up)
  const loginPayload = {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  };
  
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (loginResponse.status === 200) {
    const token = loginResponse.json('access_token') || loginResponse.json('token');
    console.log('Authentication successful for load testing');
    return { authToken: token };
  } else {
    console.log('Skipping authentication for load test (continuing without auth)');
    return { authToken: null };
  }
}

export default function(data) {
  requestCounter.add(1);
  
  group('Health Check', function() {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
    
    responseTimeTrend.add(healthRes.timings.duration);
    sleep(0.5);
  });

  group('API Metrics', function() {
    const headers = data.authToken ? 
      { 'Authorization': `Bearer ${data.authToken}` } : 
      {};
      
    const metricsRes = http.get(`${BASE_URL}/api/metrics`, { headers });
    check(metricsRes, {
      'metrics endpoint accessible': (r) => r.status === 200 || r.status === 401, // 401 is ok if no auth
      'metrics response time < 1000ms': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    responseTimeTrend.add(metricsRes.timings.duration);
    sleep(0.3);
  });

  group('Task Management', function() {
    const headers = data.authToken ? 
      { 'Authorization': `Bearer ${data.authToken}` } : 
      {};
      
    // Get tasks
    const tasksRes = http.get(`${BASE_URL}/api/tasks`, { headers });
    check(tasksRes, {
      'tasks endpoint accessible': (r) => r.status === 200 || r.status === 401,
      'tasks response time < 1000ms': (r) => r.timings.duration < 1000,
    }) || errorRate.add(1);
    
    responseTimeTrend.add(tasksRes.timings.duration);
    sleep(0.5);
  });

  group('Static Assets', function() {
    // Test serving static React app
    const staticRes = http.get(`${BASE_URL}/app`);
    check(staticRes, {
      'static app accessible': (r) => r.status === 200 || r.status === 404, // 404 is ok if build doesn't exist
      'static response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    
    responseTimeTrend.add(staticRes.timings.duration);
    sleep(0.2);
  });

  sleep(1); // Think time between iterations
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Total requests made: ${requestCounter.value}`);
}

export function handleSummary(data) {
  return {
    'tests/results/load-test-summary.json': JSON.stringify(data, null, 2),
    'tests/results/load-test-summary.html': generateHTMLReport(data),
  };
}

function generateHTMLReport(data) {
  const date = new Date().toISOString();
  return `
<!DOCTYPE html>
<html>
<head>
    <title>EasyFlow Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .metric-title { font-weight: bold; color: #333; }
        .metric-value { font-size: 1.2em; color: #007bff; }
        .pass { color: green; } .fail { color: red; }
    </style>
</head>
<body>
    <div class="header">
        <h1>EasyFlow Load Test Report</h1>
        <p>Generated: ${date}</p>
        <p>Target: ${BASE_URL}</p>
    </div>
    
    <div class="metrics">
        <div class="metric-card">
            <div class="metric-title">Total Requests</div>
            <div class="metric-value">${data.metrics.http_reqs?.values?.count || 0}</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Failed Requests</div>
            <div class="metric-value ${(data.metrics.http_req_failed?.values?.rate || 0) < 0.1 ? 'pass' : 'fail'}">
                ${((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
            </div>
        </div>
        <div class="metric-card">
            <div class="metric-title">Average Response Time</div>
            <div class="metric-value">${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms</div>
        </div>
        <div class="metric-card">
            <div class="metric-title">95th Percentile</div>
            <div class="metric-value">${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms</div>
        </div>
    </div>
    
    <h2>Test Results</h2>
    <pre>${JSON.stringify(data.metrics, null, 2)}</pre>
</body>
</html>`;
}