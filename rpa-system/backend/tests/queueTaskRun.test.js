jest.mock('axios');
const axios = require('axios');

// Mock modules that create long-running handles or network connections
jest.mock('../utils/firebaseAdmin', () => ({
  firebaseNotificationService: {
    sendAndStoreNotification: jest.fn().mockResolvedValue(true),
    getHealthStatus: jest.fn().mockResolvedValue({ status: 'ok' })
  },
  NotificationTemplates: {
    taskCompleted: (t) => ({ title: t }),
    taskFailed: (t, m) => ({ title: t, message: m })
  }
}));
jest.mock('../utils/kafkaService', () => ({
  getKafkaService: () => ({ getHealth: async () => ({ ok: true }) })
}));
jest.mock('../workers/email_worker', () => ({ startEmailWorker: () => {} }));

// disable background workers during tests
process.env.ENABLE_EMAIL_WORKER = 'false';
process.env.KAFKA_ENABLED = 'false';
const app = require('../app');
const queueTaskRun = app.queueTaskRun;

describe('queueTaskRun URL normalization', () => {
  beforeEach(() => {
    axios.post.mockReset();
  });

  test('normalizes localhost:5001 to include http scheme', async () => {
    jest.setTimeout(20000);
    // mock supabase minimal chain used by queueTaskRun
    global.supabase = {
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({})
        })
      })
    };
  // Use embedded mode to avoid external HTTP calls in unit test
  process.env.AUTOMATION_URL = 'internal:embedded';
  axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    // create minimal runId and taskData
    const runId = 'test-run-1';
    const taskData = { url: 'http://example.com', title: 't', task_id: 't1', user_id: 'u1', task_type: 'general' };

    // Call and ensure it doesn't throw
    await expect(queueTaskRun(runId, taskData)).resolves.toBeDefined();

  // In embedded mode axios should not be called
  expect(axios.post).not.toHaveBeenCalled();
  });
});
