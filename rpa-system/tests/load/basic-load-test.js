// EasyFlow Load Testing Script
// Usage: k6 run --vus 10 --duration 30s basic-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3030';
const TEST_USER_EMAIL = 'load-test@easyflow.com';
const TEST_PASSWORD = 'LoadTest123!';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 5 },   // Ramp up to 5 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 20 },  // Ramp up to 20 users  
    { duration: '5m', target: 20 },  // Stay at 20 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
    errors: ['rate<0.1'],             // Custom error rate under 10%
  },
};

// Setup function - runs once before all iterations
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  
  // Test health endpoint
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'Health endpoint is accessible': (r) => r.status === 200,
  });
  
  return { baseUrl: BASE_URL };
}

// Main test function
export default function(data) {
  const baseUrl = data.baseUrl;
  
  // Test 1: Health Check
  testHealthEndpoint(baseUrl);
  
  // Test 2: API Plans endpoint (public)
  testPublicApi(baseUrl);
  
  // Test 3: Static assets (if nginx is serving them)
  testStaticAssets(baseUrl);
  
  sleep(1);
}

function testHealthEndpoint(baseUrl) {
  const response = http.get(`${baseUrl}/health`);
  
  const success = check(response, {
    'Health check status is 200': (r) => r.status === 200,
    'Health check response time < 100ms': (r) => r.timings.duration < 100,
    'Health check has ok=true': (r) => {
      try {
        return JSON.parse(r.body).ok === true;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function testPublicApi(baseUrl) {
  const response = http.get(`${baseUrl}/api/plans`);
  
  const success = check(response, {
    'Plans API status is 200': (r) => r.status === 200,
    'Plans API response time < 300ms': (r) => r.timings.duration < 300,
    'Plans API returns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function testStaticAssets(baseUrl) {
  // Test if root returns something (HTML or redirect)
  const response = http.get(baseUrl);
  
  const success = check(response, {
    'Root endpoint accessible': (r) => r.status < 400,
    'Root endpoint response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

// Teardown function - runs once after all iterations
export function teardown(data) {
  console.log('Load test completed');
}