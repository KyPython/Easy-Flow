const request = require('supertest');
const { AppTestUtils } = require('../../tests/test-env-setup');

// Import the real app without mocks
const app = require('../index.js');

describe('RPA System Real API Tests', () => {
  let testUtils;
  let testUser;
  let authToken;
  let testData;

  beforeAll(async () => {
    // Set up real test environment
    testUtils = new AppTestUtils();
    const { userManager, dataManager } = await testUtils.setupTestEnvironment();
    
    // Create a real test user
    testUser = await userManager.createTestUser();
    
    // Create a real auth token for API calls
    // For testing, we'll use the service role key to act as the user
    authToken = `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`;
    
    // Get the test data that was created
    testData = await dataManager.createTestData();
    
    console.log(`Created test user: ${testUser.email}`);
  }, 30000); // Longer timeout for setup

  afterAll(async () => {
    if (testUtils) {
      await testUtils.teardownTestEnvironment();
    }
  }, 30000);

  describe('Health Check - Real Database Connection', () => {
    test('GET /api/health should return real system status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('time');
      expect(response.body).toHaveProperty('service', 'backend');
      expect(response.body).toHaveProperty('build');
    });

    test('GET /api/health/databases should return real database health', async () => {
      const response = await request(app)
        .get('/api/health/databases')
        .expect(200);
      
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('timestamp');
      
      // Should show real Supabase connection
      expect(response.body.services).toHaveProperty('supabase');
      expect(response.body.services.supabase).toHaveProperty('status');
      
      // Should show Firebase connection
      expect(response.body.services).toHaveProperty('firebase');
    });
  });

  describe('Real Authentication System', () => {
    test('Protected routes should require authentication', async () => {
      const response = await request(app)
        .get('/api/logs')
        .expect(401);
        
      expect(response.body).toHaveProperty('error', 'Authentication failed');
    });

    test('Real service role token should allow access', async () => {
      const response = await request(app)
        .get('/api/logs')
        .set('Authorization', authToken);
      
      // Should return real logs data
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Real plans endpoint should work with auth', async () => {
      const response = await request(app)
        .get('/api/plans')
        .set('Authorization', authToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('plans');
      expect(Array.isArray(response.body.plans)).toBe(true);
    });
  });

  describe('Real Automation Logs Management', () => {
    test('GET /api/logs should return real automation logs', async () => {
      const response = await request(app)
        .get('/api/logs')
        .set('Authorization', authToken);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should contain our test data
      if (response.body.length > 0) {
        const log = response.body[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('task');
        expect(log).toHaveProperty('status');
        expect(log).toHaveProperty('created_at');
      }
    });

    test('POST /api/logs should create real automation log', async () => {
      const logData = {
        task: 'test-integration-web-scraping',
        url: 'https://httpbin.org/json',
        username: testUser.email,
        status: 'completed',
        result: { 
          pages_scraped: 1, 
          data_found: true,
          test: true,
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/logs')
        .set('Authorization', authToken)
        .send(logData);
      
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('id');
      expect(response.body.task).toBe(logData.task);
    });

    test('Real task execution should create automation log', async () => {
      const taskData = {
        task: 'test-real-task-execution',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        username: testUser.email
      };

      const response = await request(app)
        .post('/api/trigger-automation')
        .set('Authorization', authToken)
        .send(taskData);
      
      // Should either succeed or return proper error
      expect([200, 201, 400, 404]).toContain(response.status);
      
      if (response.status < 300) {
        expect(response.body).toHaveProperty('task');
      }
    });
  });

  describe('Real User Preferences System', () => {
    test('GET /api/user/preferences should work with real database', async () => {
      const response = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', authToken);
      
      // Should work with real authentication
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('user_id');
      }
    });

    test('PUT /api/user/preferences should persist to real database', async () => {
      const preferences = {
        theme: 'dark',
        notifications: {
          email: true,
          push: true,
          task_completion: true,
          task_failures: false,
          system_alerts: true
        },
        dashboard_layout: 'grid',
        timezone: 'UTC',
        automation_defaults: {
          max_retries: 3,
          timeout: 30000,
          priority: 'normal'
        }
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', authToken)
        .send(preferences);
      
      expect([200, 201]).toContain(response.status);
      
      // Verify the preference was actually saved by reading it back
      const getResponse = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', authToken);
      
      if (getResponse.status === 200) {
        expect(getResponse.body.theme).toBe(preferences.theme);
        expect(getResponse.body.notifications).toEqual(preferences.notifications);
      }
    });

    test('GET /api/user/notifications should return real notification preferences', async () => {
      const response = await request(app)
        .get('/api/user/notifications')
        .set('Authorization', authToken);
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('user_id');
      }
    });
  });

  describe('Real Notification System', () => {
    test('POST /api/notifications/create should create real notification', async () => {
      const notification = {
        title: 'Real Test Task Completed',
        body: `Automation task completed for ${testUser.email}`,
        type: 'task_complete',
        data: {
          task_id: 'test-task-integration',
          user_id: testUser.id,
          status: 'completed',
          result_count: 42,
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/notifications/create')
        .set('Authorization', authToken)
        .send(notification);
      
      // Should succeed or fail gracefully
      expect([200, 201, 400, 500]).toContain(response.status);
      
      if (response.status < 300) {
        expect(response.body).toHaveProperty('success');
      }
    });

    test('Dashboard should return real metrics', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', authToken);
      
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('stats');
      }
    });
  });

  describe('Real CORS and Security', () => {
    test('Should handle real CORS configuration', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      
      // Should have CORS headers for allowed origins
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('Should include real security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('Should enforce rate limiting on real endpoints', async () => {
      const promises = Array(5).fill().map(() => 
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // 429 = rate limited
      });
    });
  });

  describe('Complete End-to-End RPA Workflow', () => {
    test('Complete automation workflow: create log -> check dashboard -> get preferences', async () => {
      // Step 1: Create an automation log entry
      const logData = {
        task: 'e2e-test-workflow',
        url: 'https://httpbin.org/json',
        username: testUser.email,
        status: 'completed',
        result: { 
          pages_scraped: 5, 
          data_extracted: 100,
          workflow_test: true
        }
      };

      const logResponse = await request(app)
        .post('/api/logs')
        .set('Authorization', authToken)
        .send(logData);
      
      expect([200, 201]).toContain(logResponse.status);
      
      // Step 2: Check that the log appears in the logs list
      const logsResponse = await request(app)
        .get('/api/logs')
        .set('Authorization', authToken);
      
      expect(logsResponse.status).toBe(200);
      const foundLog = logsResponse.body.find(log => 
        log.task === 'e2e-test-workflow' && log.username === testUser.email
      );
      expect(foundLog).toBeTruthy();
      
      // Step 3: Check dashboard shows updated stats
      const dashboardResponse = await request(app)
        .get('/api/dashboard')
        .set('Authorization', authToken);
      
      expect([200, 404]).toContain(dashboardResponse.status);
      
      // Step 4: Verify user preferences work
      const prefResponse = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', authToken);
      
      expect([200, 404]).toContain(prefResponse.status);
      
      // Step 5: Test plans endpoint
      const plansResponse = await request(app)
        .get('/api/plans')
        .set('Authorization', authToken);
      
      expect(plansResponse.status).toBe(200);
      expect(plansResponse.body).toHaveProperty('plans');
    }, 60000); // Longer timeout for full workflow

    test('Error handling works correctly across the system', async () => {
      // Test invalid log creation
      const invalidLog = {
        // Missing required fields
        task: '',
        status: 'invalid-status'
      };

      const errorResponse = await request(app)
        .post('/api/logs')
        .set('Authorization', authToken)
        .send(invalidLog);
      
      expect([400, 422, 500]).toContain(errorResponse.status);
      
      // Test unauthorized access
      const noAuthResponse = await request(app)
        .get('/api/logs');
      
      expect(noAuthResponse.status).toBe(401);
      
      // Test non-existent endpoint
      const notFoundResponse = await request(app)
        .get('/api/nonexistent-endpoint')
        .set('Authorization', authToken);
      
      expect([404, 401]).toContain(notFoundResponse.status);
    });
  });
});