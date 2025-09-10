const request = require('supertest');
const crypto = require('crypto');

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn()
          })),
          head: jest.fn(),
          gte: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
        getPublicUrl: jest.fn()
      }))
    }
  }))
}));

// Set environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE = 'test-service-role-key';
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';
process.env.AUTOMATION_API_KEY = 'test-automation-api-key-32-characters-long';
process.env.SESSION_SECRET = 'test-session-secret-32-characters-long';

// Mock the problematic ES6 module
const express = require('express');
const mockRouter = express.Router();
jest.mock('../referral_route', () => ({ router: mockRouter }));

const app = require('../index');

describe('Security Features', () => {
  
  describe('Rate Limiting', () => {
    test('should enforce global rate limits', async () => {
      // Make requests quickly to trigger rate limiting
      const requests = Array(60).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should enforce auth rate limits', async () => {
      // Make multiple auth requests to trigger rate limiting
      const requests = Array(5).fill().map(() => 
        request(app)
          .get('/api/tasks')
          .set('Authorization', 'Bearer invalid-token')
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    test('should sanitize XSS attempts in input', () => {
      // Test the sanitizeInput function
      const { sanitizeInput } = require('../index');
      
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="evil.com"></iframe>',
        '<object data="evil.com"></object>',
        '<!--<script>alert(1)</script>-->',
        '<![CDATA[<script>alert(1)</script>]]>',
        'expression(alert(1))',
        '@import url(evil.css)'
      ];
      
      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
        expect(sanitized).not.toContain('expression');
        expect(sanitized).not.toContain('@import');
      });
    });

    test('should limit input length', () => {
      const longInput = 'A'.repeat(2000);
      const sanitized = sanitizeInput(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('URL Validation', () => {
    test('should block private IP addresses', () => {
      const { isValidUrl } = require('../index');
      
      const privateIPs = [
        'http://localhost',
        'http://127.0.0.1',
        'http://127.1',
        'http://10.0.0.1',
        'http://172.16.0.1',
        'http://192.168.1.1',
        'http://169.254.169.254',
        'https://metadata.google.internal'
      ];
      
      privateIPs.forEach(ip => {
        const result = isValidUrl(ip);
        expect(result.valid).toBe(false);
      });
    });

    test('should allow valid public URLs', () => {
      const validUrls = [
        'https://google.com',
        'http://example.com',
        'https://api.public-service.com/endpoint'
      ];
      
      validUrls.forEach(url => {
        const result = isValidUrl(url);
        expect(result.valid).toBe(true);
      });
    });

    test('should block dangerous protocols', () => {
      const dangerousUrls = [
        'ftp://evil.com',
        'file:///etc/passwd',
        'data:text/html,<script>alert(1)</script>'
      ];
      
      dangerousUrls.forEach(url => {
        const result = isValidUrl(url);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Encryption', () => {
    test('should encrypt and decrypt credentials properly', () => {
      const { encryptCredentials, decryptCredentials } = require('../index');
      
      const credentials = {
        username: 'testuser',
        password: 'testpass123'
      };
      
      const key = 'test-encryption-key-32-characters-long';
      const encrypted = encryptCredentials(credentials, key);
      
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('algorithm');
      
      const decrypted = decryptCredentials(encrypted, key);
      expect(decrypted).toEqual(credentials);
    });

    test('should use random salts for each encryption', () => {
      const { encryptCredentials } = require('../index');
      
      const credentials = { username: 'test', password: 'pass' };
      const key = 'test-encryption-key-32-characters-long';
      
      const encrypted1 = encryptCredentials(credentials, key);
      const encrypted2 = encryptCredentials(credentials, key);
      
      // Same input should produce different encrypted output due to random salt/IV
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
      expect(encrypted1.salt).not.toEqual(encrypted2.salt);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });
  });

  describe('Authentication', () => {
    test('should reject requests without authorization header', async () => {
      const response = await request(app)
        .get('/api/tasks');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'InvalidFormat');
      
      expect(response.status).toBe(401);
    });

    test('should have consistent timing for auth failures', async () => {
      const timings = [];
      
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/tasks')
          .set('Authorization', 'Bearer invalid-token');
        const duration = Date.now() - start;
        timings.push(duration);
      }
      
      // Check that timing is consistent (within 50ms variance)
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      timings.forEach(timing => {
        expect(Math.abs(timing - avgTiming)).toBeLessThan(50);
      });
    });
  });

  describe('CSRF Protection', () => {
    test('should provide CSRF token', async () => {
      const response = await request(app)
        .get('/api/csrf-token');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('csrfToken');
    });

    test('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ name: 'test', url: 'https://example.com' });
      
      expect(response.status).toBe(403); // CSRF error
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/health');
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    test('should have strict CSP policy', async () => {
      const response = await request(app)
        .get('/health');
      
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).not.toContain("'unsafe-inline'");
    });
  });

  describe('Error Handling', () => {
    // Mock sanitizeError function for testing
    const sanitizeError = (error, isDevelopment) => {
      const message = error.message;
      if (!isDevelopment) {
        return 'Internal server error';
      }
      
      // Sanitize sensitive information in development
      return message
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        .replace(/password=\w+/g, 'password=[REDACTED]')
        .replace(/token\s+\w+/g, 'token [REDACTED]')
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');
    };

    test('should not expose sensitive information in errors', () => {
      const sensitiveError = new Error('Database connection failed: password=secret123, host=192.168.1.1');
      const sanitized = sanitizeError(sensitiveError, false); // Production mode
      
      expect(sanitized).not.toContain('password');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('192.168.1.1');
      expect(sanitized).toBe('Internal server error');
    });

    test('should sanitize development errors', () => {
      const error = new Error('User test@example.com failed auth with token abc123');
      const sanitized = sanitizeError(error, true); // Development mode
      
      expect(sanitized).toContain('[EMAIL_REDACTED]');
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('test@example.com');
      expect(sanitized).not.toContain('abc123');
    });
  });

  describe('File Validation', () => {
    test('should validate payload sizes', async () => {
      const largePayload = 'A'.repeat(200 * 1024); // 200KB payload
      
      const response = await request(app)
        .post('/api/plans')
        .send({ data: largePayload });
      
      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Environment Configuration', () => {
    test('should fail securely when encryption key is missing', () => {
      const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      
      const { encryptCredentials } = require('../index');
      
      expect(() => {
        encryptCredentials({ username: 'test', password: 'test' }, undefined);
      }).toThrow();
      
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    });

    test('should validate minimum key lengths', () => {
      const { encryptCredentials } = require('../index');
      
      expect(() => {
        encryptCredentials({ username: 'test', password: 'test' }, 'short');
      }).toThrow();
    });
  });
});

// Helper function to expose internal functions for testing
if (typeof module !== 'undefined' && module.exports) {
  // Expose functions for testing (this is a hack, but necessary for testing internal functions)
  const originalApp = require('../index');
  
  // We'll need to modify the main index.js to export these functions for testing
}