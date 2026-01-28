// Jest setup to mock external services for backend tests
// This will provide a minimal supabase client stub and mock axios to avoid network calls.

// Ensure tests run with safe, side-effect-free environment
process.env.NODE_ENV = 'test';
process.env.DISABLE_TELEMETRY = 'true';
process.env.ENABLE_EMAIL_WORKER = 'false';

// Mock telemetry initializer to avoid starting Prometheus server / SDK
jest.doMock('../middleware/telemetryInit', () => ({
 prometheusExporter: null
}));

// Mock audit logger to avoid periodic flush intervals
jest.doMock('../utils/auditLogger', () => ({
 auditLogger: {
 generateRequestId: () => 'req_test',
 logAuthEvent: async () => {}
 }
}));

// Mock Prometheus business metrics exporter to avoid setInterval
jest.doMock('../utils/prometheusMetrics', () => ({
 prometheusMetricsExporter: {
 start: jest.fn(),
 getPrometheusFormat: jest.fn(() => '')
 }
}));

// Minimal supabase-like stub with common methods used in tests
const noop = () => ({ data: null, error: null });

// Helper to create a fully chainable query builder mock
function chainableQuery(result = { data: [], error: null }) {
 const chain = {
 select: (...args) => chain,
 order: (...args) => chain,
 limit: (...args) => chain,
 eq: (...args) => chain,
 neq: (...args) => chain,
 gte: (...args) => chain,
 lte: (...args) => chain,
 lt: (...args) => chain, // needed by services
 or: (...args) => chain, // used by InstrumentedQuery
 single: async () => result,
 maybeSingle: async () => result,
 then: undefined // so it's not treated as a Promise
 };
 return chain;
}

const createStub = () => {
 const from = (table) => ({
 select: (...args) => chainableQuery({ data: [], error: null }),
 insert: (...args) => ({
 select: (...args) => ({
 single: async () => ({ data: { id: 1, ...((args && args[0]) || {}) }, error: null }),
 maybeSingle: async () => ({ data: { id: 1, ...((args && args[0]) || {}) }, error: null }),
 ...chainableQuery({ data: { id: 1, ...((args && args[0]) || {}) }, error: null })
 }),
 ...chainableQuery({ data: { id: 1, ...((args && args[0]) || {}) }, error: null })
 }),
 update: (...args) => ({
 eq: (...args) => ({
 single: async () => ({ data: { id: 1, ...((args && args[0]) || {}) }, error: null }),
 maybeSingle: async () => ({ data: { id: 1, ...((args && args[0]) || {}) }, error: null }),
 ...chainableQuery({ data: { id: 1, ...((args && args[0]) || {}) }, error: null })
 }),
 ...chainableQuery({ data: { id: 1, ...((args && args[0]) || {}) }, error: null })
 }),
 delete: (...args) => chainableQuery({ data: [], error: null }),
 maybeSingle: async () => ({ data: null, error: null })
 });
 const storage = {
 from: () => ({
 upload: async () => ({ data: null, error: null }),
 createSignedUrl: async () => ({ data: null, error: null }),
 remove: async () => ({ data: null, error: null })
 })
 };
 const auth = {
 getUser: async (token) => ({ data: { user: { id: '550e8400-e29b-41d4-a716-446655440000' } }, error: null }),
 admin: { getUserById: async () => ({ user: null }) }
 };
 return { from, storage, auth };
};

// Attach a global.supabase for tests that expect it
if (!global.supabase) {
 global.supabase = createStub();
 // Make 'from' overridable in tests
 global.supabase.from = jest.fn(global.supabase.from);
 global.supabase.rpc = jest.fn(() => ({
 single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
 then: function (resolve) { return Promise.resolve({ data: {}, error: null }).then(resolve); },
 catch: function () { return this; }
 }));
}

// Mock @supabase/supabase-js createClient to return our stub when tests call it
jest.doMock('@supabase/supabase-js', () => ({
 createClient: (url, key) => global.supabase
}));


// Mock axios to avoid network calls in unit tests
jest.mock('axios', () => {
 const post = jest.fn(async (url, payload, config) => ({ status: 200, data: { ok: true, received: payload } }));
 const get = jest.fn(async (url, config) => ({ status: 200, data: { ok: true } }));
 const put = jest.fn(async () => ({ status: 200, data: { ok: true } }));
 const patch = jest.fn(async () => ({ status: 200, data: { ok: true } }));
 const del = jest.fn(async () => ({ status: 200, data: { ok: true } }));
 const head = jest.fn(async () => ({ status: 200, headers: {} }));
 const options = jest.fn(async () => ({ status: 200, headers: {} }));
 const request = jest.fn(async () => ({ status: 200, data: { ok: true } }));

 const create = jest.fn((baseConfig = {}) => {
 const instance = {
 interceptors: {
 request: { use: jest.fn() },
 response: { use: jest.fn() }
 },
 get,
 post,
 put,
 patch,
 delete: del,
 head,
 options,
 request
 };
 return instance;
 });

 return {
 post,
 get,
 put,
 patch,
 delete: del,
 head,
 options,
 request,
 create
 };
});
const axios = require('axios');

// Silence console logs in tests except warnings/errors
// Route selected test logs to the structured logger instead of calling console.log
const logger = require('../middleware/structuredLogging');
console.log = (...args) => {
 try {
 const first = String(args[0] || '');
 if (first.includes('CORS Debug Info') || process.env.VERBOSE_TEST_LOGS === 'true') {
 logger.info(first, { args: args.slice(1) });
 }
 } catch (e) {
 // swallow errors during test bootstrap
 }
};

// Polyfills for Node environment used by some integrations
try {
 global.FormData = global.FormData || require('form-data');
// eslint-disable-next-line no-empty
} catch {}
// minimal Blob polyfill
global.Blob = global.Blob || class Blob {
 constructor(parts = [], opts = {}) { this._parts = parts; this.type = opts.type; }
};

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

// Provide simple global functions expected by tests (sanitizeInput, isValidUrl, encryptCredentials)
const crypto = require('crypto');
global.sanitizeInput = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s);
global.isValidUrl = (url) => ({ valid: true });
global.encryptCredentials = (credentials, key) => ({ encrypted: JSON.stringify(credentials), iv: 'iv' });

// Mock environment variables for testing
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'http://localhost:54321';
if (!process.env.SUPABASE_SERVICE_ROLE) process.env.SUPABASE_SERVICE_ROLE = 'mock-service-role-key';
