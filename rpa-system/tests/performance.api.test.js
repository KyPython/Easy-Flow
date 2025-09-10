// Performance testing for RPA automation API endpoints
const request = require('supertest');
const { performance } = require('perf_hooks');

// Mock Express app for testing
const express = require('express');
const app = express();
app.use(express.json());

// Mock RPA task endpoints
app.get('/api/tasks', (req, res) => {
  const start = performance.now();
  
  // Simulate database query delay
  setTimeout(() => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `task_${i + 1}`,
      name: `Automation Task ${i + 1}`,
      type: i % 2 === 0 ? 'web_scraping' : 'data_extraction',
      status: ['active', 'paused', 'completed'][i % 3],
      last_run: new Date().toISOString(),
      next_run: new Date(Date.now() + 3600000).toISOString()
    }));
    
    const end = performance.now();
    res.header('X-Response-Time', `${end - start}ms`);
    res.json({ tasks, count: tasks.length });
  }, Math.random() * 100); // Random delay 0-100ms
});

app.post('/api/run-task', (req, res) => {
  const start = performance.now();
  const { task_id } = req.body;
  
  setTimeout(() => {
    const end = performance.now();
    res.header('X-Response-Time', `${end - start}ms`);
    res.json({
      success: true,
      task_id: task_id,
      run_id: `run_${Date.now()}`,
      status: 'queued',
      estimated_completion: new Date(Date.now() + 60000).toISOString()
    });
  }, Math.random() * 50);
});

app.get('/api/runs', (req, res) => {
  const start = performance.now();
  
  setTimeout(() => {
    const runs = Array.from({ length: 20 }, (_, i) => ({
      id: `run_${i + 1}`,
      task_id: `task_${(i % 5) + 1}`,
      status: ['completed', 'running', 'failed', 'queued'][i % 4],
      started_at: new Date(Date.now() - (i * 3600000)).toISOString(),
      duration: Math.floor(Math.random() * 300000), // 0-5 minutes
      results_count: Math.floor(Math.random() * 1000)
    }));
    
    const end = performance.now();
    res.header('X-Response-Time', `${end - start}ms`);
    res.json({ runs, count: runs.length });
  }, Math.random() * 150);
});

app.post('/api/tasks', (req, res) => {
  const start = performance.now();
  
  setTimeout(() => {
    const end = performance.now();
    res.header('X-Response-Time', `${end - start}ms`);
    res.status(201).json({
      id: `task_${Date.now()}`,
      name: req.body.name || 'New Automation Task',
      type: req.body.type || 'web_scraping',
      status: 'active',
      created_at: new Date().toISOString()
    });
  }, Math.random() * 100);
});

describe('RPA Automation API Performance Tests', () => {
  describe('GET /api/tasks', () => {
    test('should respond within acceptable time limits', async () => {
      const start = performance.now();
      const response = await request(app).get('/api/tasks');
      const end = performance.now();
      const duration = end - start;

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('count');
      expect(duration).toBeLessThan(200); // Should respond in under 200ms
    });

    test('should handle concurrent requests efficiently', async () => {
      const concurrency = 5;
      const requests = Array.from({ length: concurrency }, () =>
        request(app).get('/api/tasks')
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const end = performance.now();
      const totalDuration = end - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.tasks).toHaveLength(10);
      });

      // Concurrent requests should not take much longer than a single request
      expect(totalDuration).toBeLessThan(300);
    });

    test('should include response time headers', async () => {
      const response = await request(app).get('/api/tasks');
      
      expect(response.headers).toHaveProperty('x-response-time');
      const responseTime = parseFloat(response.headers['x-response-time']);
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('POST /api/run-task', () => {
    test('should execute task within performance threshold', async () => {
      const start = performance.now();
      const response = await request(app)
        .post('/api/run-task')
        .send({ task_id: 'task_1', parameters: {} });
      const end = performance.now();
      const duration = end - start;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.task_id).toBe('task_1');
      expect(duration).toBeLessThan(100);
    });

    test('should handle multiple task executions', async () => {
      const taskRequests = [
        { task_id: 'task_1', parameters: {} },
        { task_id: 'task_2', parameters: { priority: 'high' } },
        { task_id: 'task_3', parameters: { timeout: 60000 } },
      ];

      const promises = taskRequests.map(req =>
        request(app).post('/api/run-task').send(req)
      );

      const start = performance.now();
      const responses = await Promise.all(promises);
      const end = performance.now();
      const totalDuration = end - start;

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.task_id).toBe(taskRequests[index].task_id);
      });

      expect(totalDuration).toBeLessThan(150);
    });
  });

  describe('GET /api/runs', () => {
    test('should retrieve run history quickly', async () => {
      const start = performance.now();
      const response = await request(app).get('/api/runs');
      const end = performance.now();
      const duration = end - start;

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('runs');
      expect(Array.isArray(response.body.runs)).toBe(true);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('POST /api/tasks', () => {
    test('should create task within reasonable time', async () => {
      const start = performance.now();
      const response = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Test Automation Task',
          type: 'web_scraping',
          config: { url: 'https://example.com' }
        });
      const end = performance.now();
      const duration = end - start;

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Automation Task');
      expect(response.body.type).toBe('web_scraping');
      expect(duration).toBeLessThan(150);
    });

    test('should handle multiple task creations concurrently', async () => {
      const tasks = [
        { name: 'Task 1', type: 'web_scraping', config: { url: 'https://example1.com' } },
        { name: 'Task 2', type: 'data_extraction', config: { url: 'https://example2.com' } },
        { name: 'Task 3', type: 'web_scraping', config: { url: 'https://example3.com' } },
      ];

      const taskPromises = tasks.map(task =>
        request(app).post('/api/tasks').send(task)
      );

      const start = performance.now();
      const responses = await Promise.all(taskPromises);
      const end = performance.now();
      const totalDuration = end - start;

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(tasks[index].name);
        expect(response.body.type).toBe(tasks[index].type);
      });

      expect(totalDuration).toBeLessThan(300);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should track average response times for task operations', async () => {
      const iterations = 10;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await request(app).get('/api/tasks');
        const end = performance.now();
        durations.push(end - start);
      }

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / iterations;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      expect(averageDuration).toBeLessThan(150);
      expect(maxDuration).toBeLessThan(250);
      expect(minDuration).toBeGreaterThan(0);

      console.log(`RPA Task API Performance Metrics:
        Average: ${averageDuration.toFixed(2)}ms
        Min: ${minDuration.toFixed(2)}ms
        Max: ${maxDuration.toFixed(2)}ms
      `);
    });

    test('should measure memory usage during RPA operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform multiple RPA operations
      await Promise.all([
        request(app).get('/api/tasks'),
        request(app).post('/api/run-task').send({ task_id: 'task_1', parameters: {} }),
        request(app).post('/api/tasks').send({ name: 'Test Task', type: 'web_scraping', config: { url: 'https://example.com' } }),
      ]);

      const finalMemory = process.memoryUsage();
      const memoryDiff = {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external,
      };

      // Memory usage should not increase dramatically
      expect(memoryDiff.heapUsed).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
      
      console.log(`RPA Operations Memory Usage:
        Heap Used: ${(memoryDiff.heapUsed / 1024).toFixed(2)} KB
        Heap Total: ${(memoryDiff.heapTotal / 1024).toFixed(2)} KB
        External: ${(memoryDiff.external / 1024).toFixed(2)} KB
      `);
    });

    test('should handle RPA system load testing scenario', async () => {
      const concurrency = 10;
      const requests = [];

      // Create mixed load of different RPA operations
      for (let i = 0; i < concurrency; i++) {
        if (i % 3 === 0) {
          requests.push(request(app).get('/api/tasks'));
        } else if (i % 3 === 1) {
          requests.push(
            request(app).post('/api/run-task').send({ task_id: `task_${i}`, parameters: {} })
          );
        } else {
          requests.push(
            request(app).post('/api/tasks').send({ 
              name: `Load Test Task ${i}`, 
              type: 'web_scraping',
              config: { url: `https://example${i}.com` }
            })
          );
        }
      }

      const start = performance.now();
      const responses = await Promise.all(requests);
      const end = performance.now();
      const totalDuration = end - start;

      // All requests should succeed or handle gracefully
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      // Load test should complete within reasonable time
      expect(totalDuration).toBeLessThan(600);
      
      console.log(`RPA System Load Test Results:
        Concurrent Requests: ${concurrency}
        Total Duration: ${totalDuration.toFixed(2)}ms
        Average per Request: ${(totalDuration / concurrency).toFixed(2)}ms
      `);
    });
  });
});
