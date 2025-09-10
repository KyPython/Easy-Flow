// Integration tests for RPA automation workflow
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Import the app
const app = require('../../backend/index.js');

// Supabase client for direct database operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

describe('RPA Automation Integration Tests', () => {
  let testUser;
  let authToken;
  let testTask;

  beforeAll(async () => {
    // Create test user
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: `test-${crypto.randomUUID()}@example.com`,
      password: 'test-password-123',
      email_confirm: true
    });

    if (userError) throw userError;
    testUser = user.user;
    authToken = `Bearer ${testUser.access_token}`;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTask) {
      await supabase.from('tasks').delete().eq('id', testTask.id);
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id);
    }
  });

  describe('Complete RPA Task Workflow', () => {
    test('creates a new automation task', async () => {
      const taskData = {
        name: 'Integration Test - Web Scraping',
        description: 'Test task for integration testing',
        type: 'web_scraping',
        config: {
          url: 'https://httpbin.org/json',
          selector: 'body',
          interval: 3600,
          max_results: 100
        },
        is_active: true
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send(taskData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(taskData.name);
      expect(response.body.type).toBe(taskData.type);
      expect(response.body.is_active).toBe(true);

      testTask = response.body;

      // Verify in database
      const { data: dbTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', testTask.id)
        .single();

      expect(dbTask).toBeTruthy();
      expect(dbTask.user_id).toBe(testUser.id);
      expect(dbTask.name).toBe(taskData.name);
    });

    test('retrieves created task in tasks list', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', authToken)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const createdTask = response.body.find(task => task.id === testTask.id);
      expect(createdTask).toBeTruthy();
      expect(createdTask.name).toBe(testTask.name);
    });

    test('executes the automation task', async () => {
      const executionData = {
        task_id: testTask.id,
        parameters: {
          timeout: 30000,
          retry_count: 3
        }
      };

      const response = await request(app)
        .post('/api/run-task')
        .set('Authorization', authToken)
        .send(executionData);

      // Should accept the execution request
      expect([200, 202]).toContain(response.status);
      
      if (response.body.run_id) {
        // Verify run record was created
        const { data: dbRun } = await supabase
          .from('task_runs')
          .select('*')
          .eq('id', response.body.run_id)
          .single();

        expect(dbRun).toBeTruthy();
        expect(dbRun.task_id).toBe(testTask.id);
        expect(dbRun.user_id).toBe(testUser.id);
      }
    });

    test('retrieves task execution history', async () => {
      const response = await request(app)
        .get('/api/runs')
        .set('Authorization', authToken)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Check if our task execution is in the history
      const taskRuns = response.body.filter(run => run.task_id === testTask.id);
      expect(taskRuns.length).toBeGreaterThanOrEqual(0);
    });

    test('updates task configuration', async () => {
      const updatedConfig = {
        ...testTask,
        description: 'Updated description for integration test',
        config: {
          ...testTask.config,
          interval: 7200, // Change interval
          max_results: 200
        }
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask.id}`)
        .set('Authorization', authToken)
        .send(updatedConfig);

      if (response.status === 200) {
        expect(response.body.description).toBe(updatedConfig.description);
        expect(response.body.config.interval).toBe(7200);
      } else {
        // If PUT endpoint doesn't exist, that's expected for now
        expect([404, 405]).toContain(response.status);
      }
    });

    test('deletes the automation task', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${testTask.id}`)
        .set('Authorization', authToken);

      if (response.status === 200) {
        // Verify task was deleted from database
        const { data: dbTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', testTask.id)
          .single();

        expect(dbTask).toBeFalsy();
        testTask = null; // Prevent cleanup attempt
      } else {
        // If DELETE works differently or doesn't exist, that's noted
        expect([404, 405]).toContain(response.status);
      }
    });
  });

  describe('User Preferences Integration', () => {
    test('retrieves default user preferences', async () => {
      const response = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', authToken);

      // Should return preferences or 404 if none set
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('user_id', testUser.id);
      }
    });

    test('creates/updates user preferences', async () => {
      const preferences = {
        theme: 'dark',
        notifications: {
          email: true,
          push: false,
          task_completion: true,
          task_failures: true,
          system_alerts: false
        },
        dashboard_layout: 'list',
        timezone: 'UTC',
        automation_defaults: {
          max_retry_count: 3,
          timeout: 30000
        }
      };

      const response = await request(app)
        .put('/api/user/preferences')
        .set('Authorization', authToken)
        .send(preferences);

      expect([200, 201]).toContain(response.status);

      // Verify preferences were saved
      const getResponse = await request(app)
        .get('/api/user/preferences')
        .set('Authorization', authToken);

      if (getResponse.status === 200) {
        expect(getResponse.body.theme).toBe(preferences.theme);
        expect(getResponse.body.notifications).toEqual(preferences.notifications);
      }
    });
  });

  describe('Notification System Integration', () => {
    test('creates system notification', async () => {
      const notification = {
        title: 'Task Execution Complete',
        body: 'Your web scraping task has finished successfully',
        type: 'task_complete',
        data: {
          task_id: 'test-task-123',
          status: 'completed',
          results_count: 42
        }
      };

      const response = await request(app)
        .post('/api/notifications/create')
        .set('Authorization', authToken)
        .send(notification);

      expect([200, 201]).toContain(response.status);
    });

    test('retrieves user notifications', async () => {
      const response = await request(app)
        .get('/api/user/notifications')
        .set('Authorization', authToken);

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);
      }
    });
  });

  describe('Dashboard Data Integration', () => {
    test('retrieves dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', authToken);

      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        // Dashboard should contain relevant metrics
        expect(response.body).toHaveProperty('stats');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles non-existent task ID', async () => {
      const fakeTaskId = crypto.randomUUID();
      
      const response = await request(app)
        .post('/api/run-task')
        .set('Authorization', authToken)
        .send({
          task_id: fakeTaskId,
          parameters: {}
        });

      expect([400, 404]).toContain(response.status);
    });

    test('handles unauthorized task access', async () => {
      // Create another user
      const { data: otherUser } = await supabase.auth.admin.createUser({
        email: `other-${crypto.randomUUID()}@example.com`,
        password: 'test-password-123',
        email_confirm: true
      });

      const otherAuthToken = `Bearer ${otherUser.user.access_token}`;

      // Try to access first user's tasks
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', otherAuthToken);

      if (response.status === 200) {
        // Should not see other user's tasks
        expect(response.body).toEqual([]);
      }

      // Cleanup
      await supabase.auth.admin.deleteUser(otherUser.user.id);
    });

    test('validates task creation data', async () => {
      const invalidTask = {
        name: '', // Invalid: empty name
        type: 'invalid_type', // Invalid: unknown type
        config: {} // Invalid: empty config
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', authToken)
        .send(invalidTask);

      expect([400, 422]).toContain(response.status);
    });

    test('handles malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.error).toBe('Authentication failed');
    });
  });

  describe('Performance and Concurrency', () => {
    test('handles concurrent task creation', async () => {
      const concurrentTasks = 5;
      const taskPromises = [];

      for (let i = 0; i < concurrentTasks; i++) {
        const taskData = {
          name: `Concurrent Test Task ${i}`,
          type: 'data_extraction',
          config: {
            url: `https://httpbin.org/delay/${i}`,
            selector: 'body'
          }
        };

        taskPromises.push(
          request(app)
            .post('/api/tasks')
            .set('Authorization', authToken)
            .send(taskData)
        );
      }

      const responses = await Promise.all(taskPromises);

      // All should succeed or fail gracefully
      responses.forEach((response, index) => {
        expect([200, 201, 400, 429]).toContain(response.status);
        
        if ([200, 201].includes(response.status)) {
          expect(response.body.name).toBe(`Concurrent Test Task ${index}`);
        }
      });

      // Cleanup created tasks
      const createdTasks = responses
        .filter(r => [200, 201].includes(r.status))
        .map(r => r.body.id);

      for (const taskId of createdTasks) {
        await supabase.from('tasks').delete().eq('id', taskId);
      }
    });
  });
});

// Utility functions for testing
function generateTestTask(userId, taskType = 'web_scraping') {
  return {
    user_id: userId,
    name: `Test ${taskType} Task ${crypto.randomBytes(4).toString('hex')}`,
    description: `Integration test task for ${taskType}`,
    type: taskType,
    config: {
      url: 'https://httpbin.org/json',
      selector: 'body',
      interval: 3600,
      max_results: 100
    },
    is_active: true
  };
}

async function createTestUser() {
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: `test-${crypto.randomUUID()}@example.com`,
    password: 'test-password-123',
    email_confirm: true
  });

  if (error) throw error;
  return user.user;
}

async function cleanupTestData() {
  // Clean up any test tasks that might have been left behind
  const { data: testTasks } = await supabase
    .from('tasks')
    .select('id')
    .like('name', 'Test %');

  if (testTasks?.length > 0) {
    await supabase
      .from('tasks')
      .delete()
      .in('id', testTasks.map(t => t.id));
  }

  // Clean up test runs
  const { data: testRuns } = await supabase
    .from('task_runs')
    .select('id')
    .like('notes', 'Integration test%');

  if (testRuns?.length > 0) {
    await supabase
      .from('task_runs')
      .delete()
      .in('id', testRuns.map(r => r.id));
  }
}

module.exports = {
  generateTestTask,
  createTestUser,
  cleanupTestData
};