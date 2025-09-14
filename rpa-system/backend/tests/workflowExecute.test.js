const request = require('supertest');
// disable background workers during tests
process.env.ENABLE_EMAIL_WORKER = 'false';
process.env.KAFKA_ENABLED = 'false';
const app = require('../app');

describe('POST /api/workflows/execute', () => {
  test('returns 401 when unauthenticated', async () => {
    const resp = await request(app)
      .post('/api/workflows/execute')
      .send({ workflowId: 'nonexistent' });
    expect(resp.status).toBe(401);
  });
});
