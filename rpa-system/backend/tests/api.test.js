const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock dotenv config before importing the app
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn()
    }
  }))
}));

describe('API Core Features', () => {
  let app;
  
  beforeAll(() => {
    // Set up test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE = 'test-service-key';
    process.env.PORT = '3030';
    
    // Import app after mocking
    delete require.cache[require.resolve('../index.js')];
    app = require('../index.js');
  });

  describe('Health Check', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    test('Protected routes should require authentication', async () => {
      await request(app)
        .get('/api/tasks')
        .expect(401);
    });

    test('Invalid bearer token should return 401', async () => {
      await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('CORS and Security', () => {
    test('Should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Rate Limiting', () => {
    test('Should handle multiple requests within rate limit', async () => {
      const promises = Array(5).fill().map(() => 
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});