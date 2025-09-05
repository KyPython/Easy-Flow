const request = require('supertest');
const express = require('express');

// Mock environment setup
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user' } },
        error: null
      })
    }
  }))
}));

describe('Performance Tests', () => {
  let app;
  
  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE = 'test-service-key';
    
    delete require.cache[require.resolve('../index.js')];
    app = require('../index.js');
  });

  describe('Response Time Tests', () => {
    test('Health endpoint responds within acceptable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('Authentication middleware timing consistency', async () => {
      const times = [];
      
      // Test multiple requests to check timing consistency
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/tasks')
          .set('Authorization', 'Bearer test-token');
        
        times.push(Date.now() - startTime);
      }
      
      // Check that authentication timing is relatively consistent (within 500ms range)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      expect(maxTime - minTime).toBeLessThan(500);
    });
  });

  describe('Load Tests', () => {
    test('Handle multiple concurrent health checks', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests).fill().map(() =>
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('Rate limiting works correctly', async () => {
      // Test that rate limiting doesn't prevent normal usage
      const promises = Array(5).fill().map(() =>
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      
      // Most requests should succeed (rate limit allows normal usage)
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Memory Usage Tests', () => {
    test('No obvious memory leaks in repeated requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make multiple requests
      for (let i = 0; i < 20; i++) {
        await request(app).get('/api/health');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for 20 requests)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    test('Error responses are fast', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // Error responses should be quick
    });

    test('Authentication errors have consistent timing', async () => {
      const times = [];
      
      // Test multiple auth failures to check for timing attacks protection
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/tasks')
          .set('Authorization', 'Bearer invalid-token-' + i);
        
        times.push(Date.now() - startTime);
      }
      
      // Check that error timing is consistent (within reasonable range)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      expect(maxTime - minTime).toBeLessThan(200); // Should be consistent within 200ms
    });
  });
});