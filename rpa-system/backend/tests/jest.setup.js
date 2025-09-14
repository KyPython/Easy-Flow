// Jest setup to mock external services for backend tests
// This will provide a minimal supabase client stub and mock axios to avoid network calls.

// Minimal supabase-like stub with common methods used in tests
const noop = () => ({ data: null, error: null });

const createStub = () => {
  const from = (table) => ({
    select: (...args) => ({ order: () => ({ limit: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }) }),
    insert: async () => ({ data: [], error: null }),
    update: async () => ({ data: [], error: null }),
    delete: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
  });
  const storage = {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
      createSignedUrl: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null })
    })
  };
  const auth = {
    getUser: async (token) => ({ data: { user: { id: 'test-user' } }, error: null }),
    admin: { getUserById: async () => ({ user: null }) }
  };
  return { from, storage, auth };
};

// Attach a global.supabase for tests that expect it
if (!global.supabase) {
  global.supabase = createStub();
}

// Mock @supabase/supabase-js createClient to return our stub when tests call it
jest.doMock('@supabase/supabase-js', () => ({
  createClient: (url, key) => global.supabase
}));

// Mock axios to avoid network calls in unit tests
const axios = require('axios');
jest.mock('axios');
axios.post.mockImplementation(async (url, payload) => ({ status: 200, data: { ok: true, received: payload } }));
axios.get.mockImplementation(async (url) => ({ status: 200, data: { ok: true } }));

// Mock firebaseNotificationService used by app - provide no-op implementations
const firebaseMock = {
  sendAndStoreNotification: async () => ({ success: true, store: { success: true, notificationId: 'n1' }, push: {} }),
  generateCustomToken: async () => ({ success: true, token: 'token', expiresIn: 3600, claims: {} }),
  verifyCustomToken: async () => ({ success: true, uid: 'uid', supabase_uid: 'supabase', auth_time: Date.now(), provider: 'test', claims: {} }),
  createFirebaseUser: async () => ({ success: true }),
  setUserClaims: async () => ({ success: true })
};

// Replace require cache for utils/firebaseAdmin to return the mock
jest.doMock('../utils/firebaseAdmin', () => ({
  firebaseNotificationService: firebaseMock,
  NotificationTemplates: {
    taskCompleted: (name) => ({ title: `Task completed: ${name}`, body: '' }),
    taskFailed: (name, err) => ({ title: `Task failed: ${name}`, body: err }),
    welcome: (name) => ({ title: `Welcome ${name}`, body: '' })
  }
}));

// Mock kafkaService to avoid real Kafka
jest.doMock('../utils/kafkaService', () => ({
  getKafkaService: () => ({
    sendAutomationTask: async (task) => ({ taskId: 'kt1', result: [] }),
    sendAutomationTaskWithCallback: async (task) => ({ task_id: 'kt1', status: 'completed', result: {}, worker_id: 'wk1', timestamp: Date.now() }),
    getHealth: async () => ({ ok: true, brokers: [] })
  })
}));

// Silence console logs in tests except warnings/errors
const originalLog = console.log;
console.log = (...args) => {
  if (String(args[0] || '').includes('CORS Debug Info') || process.env.VERBOSE_TEST_LOGS === 'true') {
    originalLog.apply(console, args);
  }
};

// Provide simple global functions expected by tests (sanitizeInput, isValidUrl, encryptCredentials)
const crypto = require('crypto');
global.sanitizeInput = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s);
global.isValidUrl = (url) => ({ valid: true });
global.encryptCredentials = (credentials, key) => ({ encrypted: JSON.stringify(credentials), iv: 'iv' });

