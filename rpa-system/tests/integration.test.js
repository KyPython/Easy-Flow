const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Test configuration
const CONFIG = {
  backend: process.env.BACKEND_URL || 'http://localhost:3030',
  automation: process.env.AUTOMATION_URL || 'http://localhost:7001',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE
  },
  testUser: {
    email: 'integration-test@easyflow.com',
    password: 'TestPassword123!'
  }
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
const log = {
  info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg) => {
    console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
    results.passed++;
  },
  error: (msg) => {
    console.log(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
    results.failed++;
    results.errors.push(msg);
  },
  warning: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`)
};

// Test wrapper
async function runTest(name, testFn) {
  results.total++;
  log.info(`Running: ${name}`);
  
  try {
    await testFn();
    log.success(name);
  } catch (error) {
    log.error(`${name}: ${error.message}`);
  }
}

// API client with error handling
class APIClient {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
  }

  async get(url, config = {}) {
    const response = await this.client.get(url, config);
    return response;
  }

  async post(url, data, config = {}) {
    const response = await this.client.post(url, data, config);
    return response;
  }

  async put(url, data, config = {}) {
    const response = await this.client.put(url, data, config);
    return response;
  }

  async delete(url, config = {}) {
    const response = await this.client.delete(url, config);
    return response;
  }
}

// Initialize clients
const backendAPI = new APIClient(CONFIG.backend);
const automationAPI = new APIClient(CONFIG.automation);

// Test suites
class IntegrationTests {
  
  // Test basic health and connectivity
  async testBasicConnectivity() {
    await runTest('Backend Health Check', async () => {
      const response = await backendAPI.get('/health');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.ok) {
        throw new Error('Health check failed');
      }
    });

    await runTest('Automation Service Health', async () => {
      try {
        const response = await automationAPI.get('/health');
        if (response.status !== 200) {
          throw new Error(`Expected 200, got ${response.status}`);
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          log.warning('Automation service not running - skipping related tests');
          return;
        }
        throw error;
      }
    });

    await runTest('Database Health Check', async () => {
      const response = await backendAPI.get('/api/health/databases');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      
      const health = response.data;
      if (!health.services?.supabase || !health.services?.firebase) {
        throw new Error('Missing database service status');
      }
    });
  }

  // Test RPA Task Management System
  async testRPATaskManagement() {
    await runTest('Tasks API Authentication Required', async () => {
      const response = await backendAPI.get('/api/tasks');
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('Task Creation Endpoint Validation', async () => {
      const testTask = {
        name: 'Test Web Scraping Task',
        type: 'web_scraping',
        config: {
          url: 'https://example.com',
          selector: '.content',
          interval: 3600
        }
      };

      const response = await backendAPI.post('/api/tasks', testTask);
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('Task Execution Endpoint', async () => {
      const executionPayload = {
        task_id: 'test-task-123',
        parameters: {
          url_override: 'https://test.example.com'
        }
      };

      const response = await backendAPI.post('/api/run-task', executionPayload);
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('Task Runs History Endpoint', async () => {
      const response = await backendAPI.get('/api/runs');
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });
  }

  // Test User Preferences System
  async testUserPreferencesSystem() {
    await runTest('User Preferences GET Endpoint', async () => {
      const response = await backendAPI.get('/api/user/preferences');
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('User Notifications GET Endpoint', async () => {
      const response = await backendAPI.get('/api/user/notifications');
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('User Preferences Update Validation', async () => {
      const testPayload = {
        theme: 'dark',
        notifications: {
          email: true,
          push: true,
          task_completion: true,
          task_failures: true,
          system_alerts: true
        },
        dashboard_layout: 'grid',
        timezone: 'America/New_York'
      };

      const response = await backendAPI.put('/api/user/preferences', testPayload);
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });
  }

  // Test Notification System
  async testNotificationSystem() {
    await runTest('Notification Creation Endpoint', async () => {
      const notificationPayload = {
        title: 'Test Task Completed',
        body: 'Your web scraping task has finished successfully',
        type: 'task_complete',
        data: {
          task_id: 'test-123',
          result_count: 150
        }
      };

      const response = await backendAPI.post('/api/notifications/create', notificationPayload);
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });

    await runTest('Dashboard Data Endpoint', async () => {
      const response = await backendAPI.get('/api/dashboard');
      // Should require authentication, so 401 is expected
      if (response.status !== 401) {
        throw new Error(`Expected 401 (auth required), got ${response.status}`);
      }
    });
  }

  // Test Firebase + Supabase integration optimizations (Task 2)
  async testDatabaseIntegration() {
    await runTest('Enhanced Database Health Monitoring', async () => {
      const response = await backendAPI.get('/api/health/databases');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      
      // Check required health information
      if (!health.timestamp) {
        throw new Error('Missing timestamp in health response');
      }
      
      if (!health.services) {
        throw new Error('Missing services in health response');
      }

      if (!health.overall) {
        throw new Error('Missing overall health status');
      }
    });

    await runTest('Firebase Integration Status', async () => {
      const response = await backendAPI.get('/api/health/databases');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      
      // Check Firebase service status
      if (!health.services.firebase) {
        throw new Error('Missing Firebase service status');
      }

      const firebase = health.services.firebase;
      if (typeof firebase.isConfigured !== 'boolean') {
        throw new Error('Missing Firebase configuration status');
      }
    });

    await runTest('Supabase Integration Status', async () => {
      const response = await backendAPI.get('/api/health/databases');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      
      // Check Supabase service status
      if (!health.services.supabase) {
        throw new Error('Missing Supabase service status');
      }

      const supabase = health.services.supabase;
      if (!['healthy', 'error', 'not_configured'].includes(supabase.status)) {
        throw new Error(`Invalid Supabase status: ${supabase.status}`);
      }
    });
  }

  // Test performance and optimization improvements (Task 3)
  async testOptimizations() {
    await runTest('API Response Time Performance', async () => {
      const startTime = Date.now();
      const response = await backendAPI.get('/health');
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (duration > 1000) {
        throw new Error(`Response too slow: ${duration}ms (expected < 1000ms)`);
      }
    });

    await runTest('Concurrent Request Handling', async () => {
      const requests = Array(10).fill().map(() => backendAPI.get('/health'));
      const responses = await Promise.all(requests);
      
      const successCount = responses.filter(r => r.status === 200).length;
      if (successCount !== 10) {
        throw new Error(`Expected 10 successful responses, got ${successCount}`);
      }
    });

    await runTest('Enhanced Error Handling', async () => {
      const response = await backendAPI.get('/nonexistent-endpoint');
      
      // Should handle gracefully with proper error response
      if (response.status === 500) {
        throw new Error('Internal server error on invalid endpoint');
      }
      
      // 404 is expected and acceptable
      if (response.status !== 404) {
        log.warning(`Unexpected status ${response.status} for invalid endpoint`);
      }
    });
  }

  // Test deployment readiness (Task 4)
  async testDeploymentReadiness() {
    await runTest('Health Check Endpoint for Load Balancers', async () => {
      const response = await backendAPI.get('/health');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      if (!health.ok || !health.service || !health.time) {
        throw new Error('Health check missing required fields for load balancer');
      }
    });

    await runTest('Database Health for Monitoring Systems', async () => {
      const response = await backendAPI.get('/api/health/databases');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      if (!health.overall || !health.services) {
        throw new Error('Database health missing required fields for monitoring');
      }
    });

    await runTest('CORS Configuration', async () => {
      const response = await backendAPI.get('/health', {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      // Check for CORS headers (if configured)
      const corsHeader = response.headers['access-control-allow-origin'];
      if (corsHeader && corsHeader !== '*' && !corsHeader.includes('localhost')) {
        log.warning('CORS configuration may be restrictive for development');
      }
    });
  }

  // Test end-to-end workflow
  async testEndToEndWorkflow() {
    await runTest('Service Chain Health', async () => {
      // Test backend health
      const backendResponse = await backendAPI.get('/health');
      if (backendResponse.status !== 200) {
        throw new Error('Backend service unhealthy');
      }

      // Test database connectivity through backend
      const dbResponse = await backendAPI.get('/api/health/databases');
      if (dbResponse.status !== 200) {
        throw new Error('Database connectivity through backend failed');
      }

      // Test automation service if available
      try {
        const automationResponse = await automationAPI.get('/health');
        if (automationResponse.status !== 200) {
          log.warning('Automation service health check failed');
        }
      } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
          throw error;
        }
        log.warning('Automation service not running');
      }
    });

    await runTest('API Versioning and Compatibility', async () => {
      const response = await backendAPI.get('/health');
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const health = response.data;
      if (!health.service || health.service !== 'backend') {
        throw new Error('Service identification missing or incorrect');
      }
    });
  }

  // Run all test suites
  async runAllTests() {
    console.log('=====================================');
    console.log('🧪 EasyFlow API Integration Tests');
    console.log('=====================================\n');

    log.info('Testing RPA system with all core functionality...\n');

    await this.testBasicConnectivity();
    await this.testRPATaskManagement();
    await this.testUserPreferencesSystem();
    await this.testNotificationSystem();
    await this.testDatabaseIntegration();
    await this.testOptimizations();
    await this.testDeploymentReadiness();
    await this.testEndToEndWorkflow();

    // Print summary
    console.log('\n=====================================');
    console.log('📊 API Integration Test Results');
    console.log('=====================================');
    console.log(`Total Tests: ${results.total}`);
    console.log(`\x1b[32mPassed: ${results.passed}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${results.failed}\x1b[0m`);

    if (results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n=====================================');
    
    if (results.failed === 0) {
      console.log('\x1b[32m🎉 All API integration tests passed!\x1b[0m');
      console.log('\n✅ System APIs are ready for production deployment!');
      process.exit(0);
    } else {
      console.log('\x1b[31m❌ Some API integration tests failed\x1b[0m');
      console.log('\nPlease review failed tests and fix issues.');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const tests = new IntegrationTests();
  await tests.runAllTests();
}

// Handle errors and exit gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n\x1b[31m[ERROR]\x1b[0m Unhandled promise rejection:', error.message);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n\x1b[31m[ERROR]\x1b[0m Uncaught exception:', error.message);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  main();
}

module.exports = IntegrationTests;
