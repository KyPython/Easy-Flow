// Performance and load tests for file sharing API endpoints
const request = require('supertest');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

// Import the app (adjust path as needed)
const app = require('../../backend/app');

describe('File Sharing API Performance Tests', () => {
  let authToken;
  let testFileId;
  let testUserId;

  beforeAll(async () => {
    // Setup test data
    testUserId = 'test-user-' + crypto.randomUUID();
    testFileId = 'test-file-' + crypto.randomUUID();
    
    // Mock authentication - adjust based on your auth system
    authToken = 'Bearer test-token-123';
  });

  describe('Share Creation Performance', () => {
    test('creates share in under 200ms', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: testFileId,
          permission: 'view',
          requirePassword: false,
          allowAnonymous: true
        })
        .expect(201);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body).toHaveProperty('share_token');
    });

    test('handles concurrent share creation', async () => {
      const concurrentRequests = 10;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: `test-file-${i}`,
            permission: 'download',
            requirePassword: false,
            allowAnonymous: true
          })
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All requests should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
      
      // All should be successful
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('shareUrl');
      });

      // Each request should have unique token
      const tokens = responses.map(r => r.body.share_token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(concurrentRequests);
    });

    test('password hashing performance', async () => {
      const startTime = performance.now();
      
      await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: testFileId,
          permission: 'download',
          requirePassword: true,
          password: 'complex-password-123!@#',
          allowAnonymous: true
        })
        .expect(201);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Password hashing should add minimal overhead
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Share Retrieval Performance', () => {
    let shareIds = [];

    beforeAll(async () => {
      // Create test shares
      for (let i = 0; i < 50; i++) {
        const response = await request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: testFileId,
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          });
        shareIds.push(response.body.id);
      }
    });

    test('retrieves shares list in under 100ms', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get(`/api/files/${testFileId}/shares`)
        .set('Authorization', authToken)
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
      expect(response.body.shares).toHaveLength(50);
    });

    test('handles large shares list efficiently', async () => {
      // Create many more shares
      const additionalShares = 200;
      const promises = Array.from({ length: additionalShares }, () =>
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: testFileId,
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          })
      );

      await Promise.all(promises);

      const startTime = performance.now();
      
      const response = await request(app)
        .get(`/api/files/${testFileId}/shares`)
        .set('Authorization', authToken)
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still be fast even with 250 shares
      expect(duration).toBeLessThan(200);
      expect(response.body.shares).toHaveLength(250);
    });
  });

  describe('Share Access Performance', () => {
    let shareToken;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: testFileId,
          permission: 'download',
          requirePassword: false,
          allowAnonymous: true
        });
      shareToken = response.body.share_token;
    });

    test('accesses shared file in under 150ms', async () => {
      const startTime = performance.now();
      
      await request(app)
        .post('/api/shared/access')
        .send({
          shareToken: shareToken
        })
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(150);
    });

    test('handles concurrent access requests', async () => {
      const concurrentRequests = 20;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .post('/api/shared/access')
          .send({
            shareToken: shareToken
          })
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All concurrent requests should complete quickly
      expect(duration).toBeLessThan(1000);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('file');
        expect(response.body).toHaveProperty('permission');
      });
    });

    test('password validation performance', async () => {
      // Create password-protected share
      const protectedResponse = await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: testFileId,
          permission: 'download',
          requirePassword: true,
          password: 'test-password-123',
          allowAnonymous: true
        });

      const protectedToken = protectedResponse.body.share_token;

      const startTime = performance.now();
      
      await request(app)
        .post('/api/shared/access')
        .send({
          shareToken: protectedToken,
          password: 'test-password-123'
        })
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Password validation should add minimal overhead
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Share Management Performance', () => {
    let shareId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: testFileId,
          permission: 'view',
          requirePassword: false,
          allowAnonymous: true
        });
      shareId = response.body.id;
    });

    test('updates share in under 100ms', async () => {
      const startTime = performance.now();
      
      await request(app)
        .put(`/api/files/shares/${shareId}`)
        .set('Authorization', authToken)
        .send({
          permission: 'download',
          requirePassword: true,
          password: 'new-password-123'
        })
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    test('deletes share in under 50ms', async () => {
      const startTime = performance.now();
      
      await request(app)
        .delete(`/api/files/shares/${shareId}`)
        .set('Authorization', authToken)
        .expect(200);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
    });

    test('handles bulk operations efficiently', async () => {
      // Create multiple shares
      const createPromises = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: testFileId,
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          })
      );

      const createResponses = await Promise.all(createPromises);
      const createdIds = createResponses.map(r => r.body.id);

      // Delete all shares
      const startTime = performance.now();
      
      const deletePromises = createdIds.map(id =>
        request(app)
          .delete(`/api/files/shares/${id}`)
          .set('Authorization', authToken)
      );

      await Promise.all(deletePromises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Bulk deletion should be efficient
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Database Performance', () => {
    test('share token uniqueness check is fast', async () => {
      // Create many shares to test uniqueness constraint performance
      const promises = Array.from({ length: 100 }, () =>
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: crypto.randomUUID(),
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          })
      );

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Even with uniqueness checks, should be reasonably fast
      expect(duration).toBeLessThan(3000);
      
      // All should have unique tokens
      const tokens = responses.map(r => r.body.share_token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(100);
    });

    test('expired shares cleanup performance', async () => {
      // Create shares with past expiration dates
      const expiredShares = Array.from({ length: 50 }, () =>
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: crypto.randomUUID(),
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true,
            expiresAt: '2020-01-01T00:00:00Z' // Past date
          })
      );

      await Promise.all(expiredShares);

      // Measure cleanup operation performance
      const startTime = performance.now();
      
      // Trigger cleanup (this would normally be a scheduled job)
      // For testing, we'll simulate accessing expired shares
      const accessPromises = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/shared/access')
          .send({
            shareToken: 'expired-token-' + crypto.randomBytes(16).toString('hex')
          })
          .expect(404) // Should fail for expired/invalid tokens
      );

      await Promise.allSettled(accessPromises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Expired token checks should be fast
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Memory Usage', () => {
    test('does not leak memory with many share operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: `test-file-${i}`,
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          });

        await request(app)
          .post('/api/shared/access')
          .send({
            shareToken: response.body.share_token
          });

        await request(app)
          .delete(`/api/files/shares/${response.body.id}`)
          .set('Authorization', authToken);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    test('handles invalid requests quickly', async () => {
      const startTime = performance.now();
      
      // Invalid file ID
      await request(app)
        .post('/api/files/shares')
        .set('Authorization', authToken)
        .send({
          fileId: 'invalid-file-id',
          permission: 'view'
        })
        .expect(404);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Error responses should be fast
      expect(duration).toBeLessThan(50);
    });

    test('rate limiting works efficiently', async () => {
      // This test would depend on your rate limiting implementation
      const promises = Array.from({ length: 100 }, () =>
        request(app)
          .post('/api/files/shares')
          .set('Authorization', authToken)
          .send({
            fileId: testFileId,
            permission: 'view',
            requirePassword: false,
            allowAnonymous: true
          })
      );

      const startTime = performance.now();
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Rate limiting should not significantly slow down the system
      expect(duration).toBeLessThan(5000);

      // Some requests might be rate limited (429 status)
      const successfulRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      const rateLimitedRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(successfulRequests.length + rateLimitedRequests.length).toBe(100);
    });
  });
});

// Utility function to generate test data
function generateTestShares(count, fileId) {
  return Array.from({ length: count }, (_, i) => ({
    fileId: fileId,
    permission: ['view', 'download'][i % 2],
    requirePassword: i % 3 === 0,
    password: i % 3 === 0 ? `password-${i}` : null,
    allowAnonymous: true,
    expiresAt: i % 5 === 0 ? new Date(Date.now() + 86400000).toISOString() : null
  }));
}

// Performance benchmark helper
function benchmark(name, fn) {
  return async () => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return end - start;
  };
}

module.exports = {
  generateTestShares,
  benchmark
};
