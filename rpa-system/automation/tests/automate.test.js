const axios = require('axios');

const BASE_URL = 'http://localhost:7001';

describe('Automation API Tests', () => {
  test('Health Check Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('ok', true);
  });

  test('Run Automation Endpoint', async () => {
    const payload = {
      url: 'https://example.com',
      username: 'testuser',
      password: 'testpassword',
    };

    const response = await axios.post(`${BASE_URL}/run`, payload);
    expect(response.status).toBe(200);
    expect(response.data.result).toHaveProperty('message', 'Automation executed successfully!');
  });
});

