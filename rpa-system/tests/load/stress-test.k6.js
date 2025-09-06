/**
 * K6 Stress Test for EasyFlow API
 * Tests system behavior under extreme load to find breaking points
 * 
 * Usage:
 *   k6 run --env BACKEND_URL=http://staging-url:3030 stress-test.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');
const successRate = new Rate('success_rate');

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Normal load
    { duration: '2m', target: 100 },   // Increased load
    { duration: '3m', target: 200 },   // High load
    { duration: '2m', target: 400 },   // Stress load
    { duration: '3m', target: 400 },   // Maintain stress
    { duration: '2m', target: 600 },   // Breaking point
    { duration: '3m', target: 600 },   // Maintain breaking point
    { duration: '5m', target: 0 },     // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'], // 99% under 3s (relaxed for stress test)
    http_req_failed: ['rate<0.5'],     // Allow up to 50% failures in stress test
  },
};

const BASE_URL = __ENV.BACKEND_URL || 'http://localhost:3030';

export default function() {
  // Simulate realistic user behavior under stress
  const scenarios = [
    healthCheckScenario,
    apiCallScenario,
    bulkRequestScenario
  ];
  
  // Randomly select a scenario
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();
}

function healthCheckScenario() {
  group('Health Check Spam', function() {
    const response = http.get(`${BASE_URL}/health`);
    
    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'response time acceptable': (r) => r.timings.duration < 5000,
    });
    
    successRate.add(success);
    responseTimeTrend.add(response.timings.duration);
    
    if (!success) errorRate.add(1);
    
    sleep(0.1); // Minimal sleep for stress
  });
}

function apiCallScenario() {
  group('API Stress Test', function() {
    const endpoints = ['/api/metrics', '/api/tasks', '/api/runs'];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    const response = http.get(`${BASE_URL}${endpoint}`);
    
    const success = check(response, {
      'status is not 5xx': (r) => r.status < 500,
      'response received': (r) => r.body.length > 0 || r.status === 401, // 401 is ok for unauthed
    });
    
    successRate.add(success);
    responseTimeTrend.add(response.timings.duration);
    
    if (!success) errorRate.add(1);
    
    sleep(0.2);
  });
}

function bulkRequestScenario() {
  group('Bulk Request Stress', function() {
    // Send multiple requests in quick succession
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(['GET', `${BASE_URL}/health`, null, { tags: { name: 'bulk_health' } }]);
      requests.push(['GET', `${BASE_URL}/api/metrics`, null, { tags: { name: 'bulk_metrics' } }]);
    }
    
    const responses = http.batch(requests);
    
    let successCount = 0;
    responses.forEach(response => {
      const success = check(response, {
        'bulk request successful': (r) => r.status < 400 || r.status === 401,
      });
      
      if (success) successCount++;
      responseTimeTrend.add(response.timings.duration);
    });
    
    const overallSuccess = successCount / responses.length > 0.7; // 70% success rate
    successRate.add(overallSuccess);
    
    if (!overallSuccess) errorRate.add(1);
    
    sleep(0.5);
  });
}

export function handleSummary(data) {
  const report = generateStressReport(data);
  
  return {
    'tests/results/stress-test-summary.json': JSON.stringify(data, null, 2),
    'tests/results/stress-test-report.html': report,
    stdout: `
🚀 STRESS TEST COMPLETED 🚀

📊 KEY METRICS:
• Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
• Success Rate: ${((1 - (data.metrics.http_req_failed?.values?.rate || 0)) * 100).toFixed(2)}%
• Avg Response Time: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms
• 95th Percentile: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms

🎯 THRESHOLDS:
${Object.entries(data.thresholds || {}).map(([key, result]) => 
  `• ${key}: ${result.ok ? '✅ PASS' : '❌ FAIL'}`
).join('\n')}

📁 Reports saved to tests/results/
    `
  };
}

function generateStressReport(data) {
  const date = new Date().toISOString();
  const totalRequests = data.metrics.http_reqs?.values?.count || 0;
  const failureRate = data.metrics.http_req_failed?.values?.rate || 0;
  const avgDuration = data.metrics.http_req_duration?.values?.avg || 0;
  const p95Duration = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99Duration = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>EasyFlow Stress Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 5px solid #667eea; }
        .metric-title { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .metric-value { font-size: 32px; font-weight: bold; color: #333; }
        .metric-unit { font-size: 16px; color: #888; }
        .status-good { color: #10b981; } .status-warning { color: #f59e0b; } .status-bad { color: #ef4444; }
        .thresholds { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0; }
        .threshold-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
        .pass { color: #10b981; font-weight: bold; } .fail { color: #ef4444; font-weight: bold; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 20px 0; }
        pre { background: #f8f9fa; padding: 20px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 EasyFlow Stress Test Report</h1>
            <p>Breaking Point Analysis & Performance Limits</p>
            <p><strong>Target:</strong> ${BASE_URL} | <strong>Generated:</strong> ${date}</p>
        </div>
        
        <div class="summary">
            <div class="card">
                <div class="metric-title">Total Requests</div>
                <div class="metric-value">${totalRequests.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="metric-title">Success Rate</div>
                <div class="metric-value ${failureRate < 0.1 ? 'status-good' : failureRate < 0.3 ? 'status-warning' : 'status-bad'}">
                    ${((1 - failureRate) * 100).toFixed(1)}<span class="metric-unit">%</span>
                </div>
            </div>
            <div class="card">
                <div class="metric-title">Average Response</div>
                <div class="metric-value ${avgDuration < 1000 ? 'status-good' : avgDuration < 2000 ? 'status-warning' : 'status-bad'}">
                    ${avgDuration.toFixed(0)}<span class="metric-unit">ms</span>
                </div>
            </div>
            <div class="card">
                <div class="metric-title">95th Percentile</div>
                <div class="metric-value ${p95Duration < 2000 ? 'status-good' : p95Duration < 4000 ? 'status-warning' : 'status-bad'}">
                    ${p95Duration.toFixed(0)}<span class="metric-unit">ms</span>
                </div>
            </div>
        </div>
        
        <div class="thresholds">
            <h3>🎯 Performance Thresholds</h3>
            ${Object.entries(data.thresholds || {}).map(([threshold, result]) => `
                <div class="threshold-item">
                    <span>${threshold}</span>
                    <span class="${result.ok ? 'pass' : 'fail'}">${result.ok ? '✅ PASS' : '❌ FAIL'}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="recommendations">
            <h3>💡 Performance Recommendations</h3>
            <ul>
                ${failureRate > 0.1 ? '<li><strong>High Error Rate:</strong> Consider adding rate limiting, connection pooling, or horizontal scaling.</li>' : ''}
                ${avgDuration > 1000 ? '<li><strong>Slow Response Times:</strong> Investigate database query optimization and caching strategies.</li>' : ''}
                ${p95Duration > 3000 ? '<li><strong>High Tail Latency:</strong> Consider implementing circuit breakers and timeout mechanisms.</li>' : ''}
                ${totalRequests > 10000 ? '<li><strong>High Load Handled:</strong> Good performance under stress. Consider this baseline for capacity planning.</li>' : ''}
            </ul>
        </div>
        
        <details>
            <summary><h3>📈 Detailed Metrics</h3></summary>
            <pre>${JSON.stringify(data.metrics, null, 2)}</pre>
        </details>
    </div>
</body>
</html>`;
}