const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const multer = require('multer');
// Load environment variables from the backend/.env file early so modules that
// require configuration (Firebase, Supabase, etc.) see the variables on require-time.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { firebaseNotificationService, NotificationTemplates } = require('./utils/firebaseAdmin');
const { getKafkaService } = require('./utils/kafkaService');
const taskStatusStore = require('./utils/taskStatusStore');
const { usageTracker } = require('./utils/usageTracker');
const { auditLogger } = require('./utils/auditLogger');
 const { createClient } = require('@supabase/supabase-js');
 const fs = require('fs');
 const morgan = require('morgan');
 const path = require('path');
const { startEmailWorker } = require('./workers/email_worker');
const { spawn } = require('child_process');


const app = express();
const PORT = process.env.PORT || 3030;

// --- Old CORS configuration removed - using comprehensive CORS config below ---

// Add after imports, before route definitions (around line 100)

// --- PUBLIC HEALTH ENDPOINTS (must be above auth middleware) ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'backend', build: process.env.BUILD_ID || 'dev' });
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'backend', build: process.env.BUILD_ID || 'dev' });
});

// Authentication middleware for individual routes
const authMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const minDelay = 100; // Minimum delay in ms to prevent timing attacks
  
  // Test bypass for Jest tests
  if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_TOKEN === 'true') {
    req.user = { 
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      name: 'Test User'
    };
    return next();
  }
  
  try {
    if (!supabase) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] supabase client missing (check SUPABASE_URL / SUPABASE_SERVICE_ROLE)');
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      res.set('x-auth-reason', 'no-supabase');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const authHeader = (req.get('authorization') || '').trim();
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
    
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] missing bearer token header for path', req.path);
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      res.set('x-auth-reason', 'no-token');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // validate token via Supabase server client
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth] token validation failed', { path: req.path, error: error?.message });
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      res.set('x-auth-reason', 'invalid-token');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // attach user to request for downstream handlers
    req.user = data.user;

    // Ensure minimum delay even for successful auth
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
    return next();

  } catch (err) {
    console.error('[auth middleware] error', err?.message || err);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
  res.set('x-auth-reason', 'exception');
  return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Rate limiting - More restrictive limits
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for development
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

// Email queue schema probe (helps debug Supabase schema issues quickly)
app.get('/api/health/email-schema', async (_req, res) => {
  const probe = { has_table: false, has_function: false, errors: {} };
  try {
    if (!supabase) throw new Error('supabase unavailable');
    // Probe table existence
    const { error: tableErr } = await supabase.from('email_queue').select('id').limit(1);
    probe.has_table = !tableErr;
    if (tableErr) probe.errors.table = tableErr.message;
    // Probe function existence
    const now = new Date(0).toISOString();
    const { error: funcErr } = await supabase.rpc('claim_email_queue_item', { now_ts: now });
    probe.has_function = !funcErr;
    if (funcErr) probe.errors.function = funcErr.message;
    return res.json({ ok: true, probe });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e), probe });
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Increased for development
  message: {
    error: 'API rate limit exceeded, please try again later.'
  }
});

// Strict limiter for automation endpoints
const automationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Increased for development
  message: {
    error: 'Automation rate limit exceeded, please try again later.'
  }
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
  styleSrc: ["'self'", "https:"],
      scriptSrc: ["'self'", "https://www.uchat.com.au", "https://sdk.dfktv2.com", "https://www.googletagmanager.com"],
      imgSrc: ["'self'", "https:"],
      connectSrc: ["'self'", "https://sdk.dfktv2.com", "https://www.uchat.com.au", "https://www.google-analytics.com", "https://analytics.google.com"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  permissionsPolicy: {
    fullscreen: [],
    camera: [],
    microphone: [],
    geolocation: []
  }
}));

// Add cookie-parser with secret for signed cookies (required for CSRF)
app.use(cookieParser(process.env.SESSION_SECRET || 'test-session-secret-32-characters-long'));


// Apply global rate limiter to all routes
app.use(globalLimiter);

// For test: apply authLimiter to /api/tasks and /api/health
if (process.env.NODE_ENV === 'test') {
  app.use(['/api/tasks', '/api/health'], authLimiter);
}

// --- Rate limit error handler: force 429 for rate limit errors ---
app.use((err, req, res, next) => {
  if (err && err.status === 429) {
    return res.status(429).json({ error: err.message || 'Too many requests' });
  }
  next(err);
});

app.use(express.json()); // ensure body parser present

// Dev bypass middleware (attach req.devBypass and req.devUser when header matches)
try {
  const devBypass = require('./middleware/devBypass');
  app.use(devBypass);
} catch (err) {
  console.warn('[boot] devBypass middleware not mounted:', err?.message || err);
}

// Set secure session cookie defaults
app.use((req, res, next) => {
  // Set secure cookie defaults for all cookies
  const originalCookie = res.cookie;
  res.cookie = function(name, value, options = {}) {
    const secureOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: options.maxAge || 3600000, // 1 hour default
      ...options
    };
    return originalCookie.call(this, name, value, secureOptions);
  };
  next();
});

// --- Supabase & App Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;
if (!supabase) {
  console.warn('⚠️ Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
} else {
  // Initialize usage tracker with supabase client
  usageTracker.initialize(supabase);
  console.log('✅ Usage tracker initialized');
}
const ARTIFACTS_BUCKET = process.env.SUPABASE_BUCKET || 'artifacts';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});
const USE_SIGNED_URLS = (process.env.SUPABASE_USE_SIGNED_URLS || 'true').toLowerCase() !== 'false';
const SIGNED_URL_EXPIRES = Math.max(60, parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || '86400', 10));
const DOWNLOADS_DIR_CONTAINER = process.env.DOWNLOADS_DIR_CONTAINER || '/downloads';
const DOWNLOADS_DIR_HOST = process.env.DOWNLOADS_DIR_HOST || (process.cwd().includes('/workspace') ? '/workspace/downloads' : path.join(process.cwd(), 'downloads'));


// CORS: sensible defaults in dev; restrict in prod via ALLOWED_ORIGINS
// Tip: set ALLOWED_ORIGINS as a comma-separated list of exact origins.
// Optional: set ALLOWED_ORIGIN_SUFFIXES for wildcard-like suffix matches (e.g. ".vercel.app").
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const DEFAULT_PROD_ORIGINS = [
  'https://easy-flow-lac.vercel.app',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || (process.env.NODE_ENV === 'production'
  ? DEFAULT_PROD_ORIGINS.join(',')
  : DEFAULT_DEV_ORIGINS.concat(DEFAULT_PROD_ORIGINS).join(',')))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_SUFFIXES = (process.env.ALLOWED_ORIGIN_SUFFIXES || '.vercel.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Debug logging for CORS configuration (quiet in production)
if (process.env.NODE_ENV !== 'production') {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 CORS Debug Info (app.js):');
    console.log('   ALLOWED_ORIGINS env var:', process.env.ALLOWED_ORIGINS);
    console.log('   Parsed ALLOWED_ORIGINS:', ALLOWED_ORIGINS);
    console.log('   NODE_ENV:', process.env.NODE_ENV);
  }
}

const corsOptions = {
  origin: (origin, cb) => {
    // Allow non-browser requests (no Origin header)
    if (!origin) return cb(null, true);

    // Exact allow-list
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // Suffix-based allow (e.g., preview deployments like *.vercel.app)
    if (ALLOWED_SUFFIXES.some(suf => origin.endsWith(suf))) return cb(null, true);

    // As a last resort in dev, be permissive when not explicitly configured
    if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') return cb(null, true);

    console.warn('🚫 CORS blocked origin (app.js):', origin);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // When allowedHeaders is omitted, the cors package reflects the request's Access-Control-Request-Headers
  credentials: true,
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Disposition'],
};

app.use(cors(corsOptions));
// Ensure preflight requests are handled consistently
app.options('*', cors(corsOptions));

// The Polar webhook needs a raw body, so we conditionally skip the JSON parser for it.
// For all other routes, this middleware will parse the JSON body.
// It must be registered before any routes that need to access `req.body`.
app.use((req, res, next) => {
  if (req.path.startsWith('/polar-webhook')) {
    return next();
  }
  return express.json({ limit: '100kb' })(req, res, next); // Reduced from 1mb to 100kb
});

// URL-encoded payload limit
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// File upload middleware (guarded for lightweight dev setups)
let fileUpload;
try {
  fileUpload = require('express-fileupload');
} catch (e) {
  console.warn('⚠️ express-fileupload not installed; file upload endpoints will respond with 501 in dev');
  fileUpload = null;
}

if (fileUpload) {
  app.use('/api/files', fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (100MB max)',
    useTempFiles: true,
    tempFileDir: '/tmp/',
    safeFileNames: true,
    preserveExtension: true,
  }));
} else {
  // Basic fallback to avoid breaking routes that mount `/api/files`
  app.use('/api/files', (req, res) => {
    res.status(501).json({ error: 'file-upload-middleware-not-installed', message: 'Install express-fileupload to enable file uploads in dev' });
  });
}

// CSRF Protection (after body parsing, before routes)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000,
    signed: true
  },
  secret: process.env.SESSION_SECRET || 'test-session-secret-32-characters-long'
});

// --- CSRF error handler: force 403 for CSRF errors ---
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});

// --- PUBLIC API ENDPOINTS (move above auth middleware) ---
// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// GET /api/plans - Fetch all available subscription plans
app.get('/api/plans', async (_req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });
    const { data, error } = await supabase.from('plans').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/plans] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plans', details: err.message });
  }
});

// Fetch recent logs
app.get('/api/logs', async (req, res) => {
  try {
    if (!supabase) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
  }
});

// Apply CSRF protection to state-changing routes (temporarily disabled for testing)

// In test mode, enforce CSRF for POST /api/tasks only
if (process.env.NODE_ENV === 'test') {
  app.post('/api/tasks', csrfProtection, (req, res, next) => next());
} else {
  app.use('/api', (req, res, next) => {
    // Skip CSRF for GET requests and webhooks
    if (req.method === 'GET' || req.path.startsWith('/polar-webhook')) {
      return next();
    }
    return csrfProtection(req, res, next);
  });
}

// Development convenience: return default user preferences when unauthenticated
// This allows the dashboard to render in local dev without a full auth setup.
app.get('/api/user/preferences', async (req, res, next) => {
  try {
    const authHeader = (req.get('authorization') || '').trim();
    const hasToken = authHeader.split(' ').length === 2;
    if (process.env.NODE_ENV !== 'production' && !hasToken) {
      // Richer default preferences used by the dashboard in local dev
      // Includes a sample user id and feature flags to simulate feature gating.
      return res.json({
        ok: true,
        source: 'dev-fallback',
        userId: process.env.DEV_USER_ID || 'dev-user-12345',
        theme: (process.env.DEV_THEME || 'light'),
        language: (process.env.DEV_LANGUAGE || 'en'),
        builderView: 'builder',
        shortcuts: {},
        featureFlags: {
          enableNewBuilder: (process.env.DEV_ENABLE_NEW_BUILDER || 'false') === 'true',
          enableBetaActions: (process.env.DEV_ENABLE_BETA_ACTIONS || 'false') === 'true',
        },
        clock: new Date().toISOString()
      });
    }
    // otherwise fall through to auth-protected routes (or the auth middleware)
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'preferences-error', detail: e?.message || String(e) });
  }
});

// Dev-only: seed a minimal workflow into the DB for local testing
app.post('/api/dev/seed-sample-workflow', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'not-available' });
    }
    if (!supabase) {
      return res.status(400).json({ error: 'supabase-not-configured', message: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in backend .env to use the dev seeder.' });
    }

    const allowDraft = (process.env.ALLOW_DRAFT_EXECUTION || '').toLowerCase() === 'true';
    const status = allowDraft ? 'draft' : 'active';

    // Minimal workflow
    const canvas_config = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    // Determine a valid user_id to attach the seeded workflow to.
    // Prefer an existing profile in the DB; fall back to DEV_USER_ID env if it exists and matches a profile.
    let userIdToUse = null;
    try {
      const { data: someProfiles } = await supabase.from('profiles').select('id').limit(1);
      if (someProfiles && someProfiles.length > 0) {
        userIdToUse = someProfiles[0].id;
      }
    } catch (e) {
      // ignore - we'll validate below
    }

    const defaultDevUserId = process.env.DEV_USER_ID;
    if (!userIdToUse && defaultDevUserId) {
      // verify the provided DEV_USER_ID exists
      try {
        const { data: p } = await supabase.from('profiles').select('id').eq('id', defaultDevUserId).limit(1).maybeSingle();
        if (p && p.id) userIdToUse = p.id;
      } catch (e) {
        // ignore
      }
    }

    if (!userIdToUse) {
        // Attempt to create a dev user using the Supabase Admin API (requires service role key)
        try {
          const email = process.env.DEV_USER_EMAIL || `dev+${Date.now()}@example.com`;
          const password = process.env.DEV_USER_PASSWORD || crypto.randomBytes(8).toString('hex');
          // Preferred: use the JS client admin API when available
          if (supabase && supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.createUser === 'function') {
            console.log('[dev seeder] creating dev user via supabase.admin.createUser', { email });
            const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
            if (createErr || !newUser) {
              console.error('[dev seeder] failed to create dev user via admin API:', createErr);
            } else {
              userIdToUse = newUser.id || (newUser.user && newUser.user.id) || null;
            }
          }

          // Fallback: call Supabase Admin REST API directly (works when service role key is available)
          if (!userIdToUse) {
            try {
              const adminUrl = `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1/admin/users`;
              console.log('[dev seeder] attempting Supabase Admin REST API createUser', { adminUrl, email });
              const resp = await axios.post(adminUrl, { email, password, email_confirm: true }, {
                headers: {
                  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                  apikey: process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              });
              const data = resp.data || {};
              userIdToUse = data?.id || data?.user?.id || data?.user?.uid || null;
              console.log('[dev seeder] admin REST create user resp:', { status: resp.status, id: userIdToUse });
            } catch (e) {
              console.error('[dev seeder] admin REST createUser failed:', e?.message || e);
            }
          }

          if (!userIdToUse) {
            return res.status(400).json({
              error: 'no-valid-user',
              message: 'No existing Supabase user found and automatic creation failed. Create a user in Supabase or set DEV_USER_ID in backend .env to a valid auth user id.'
            });
          }
        } catch (e) {
          console.error('[dev seeder] admin createUser failed:', e?.message || e);
          return res.status(500).json({ error: 'create-user-failed', detail: e?.message || String(e) });
        }
    }

    const { data: wf, error: wfError } = await supabase
      .from('workflows')
      .insert([{ name: 'Dev Sample Workflow', description: 'Seeded for local development', status, canvas_config, user_id: userIdToUse }])
      .select()
      .maybeSingle();

    if (wfError || !wf) {
      console.error('[dev seeder] failed to create workflow:', wfError);
      return res.status(500).json({ error: 'create-workflow-failed', detail: wfError?.message || String(wfError) });
    }

    // Minimal steps: start -> end
    // Minimal step shape - avoid DB-specific columns like 'order_index' which may not be
    // present in all PostgREST/migration configurations. Keep only common columns.
    const steps = [
      {
        workflow_id: wf.id,
        name: 'Start',
        step_type: 'start',
        action_type: null,
        config: {},
        step_key: 'start'
      },
      {
        workflow_id: wf.id,
        name: 'End',
        step_type: 'end',
        action_type: null,
        config: { success: true, message: 'Completed by dev seeder' },
        step_key: 'end'
      }
    ];

    const { data: stepData, error: stepError } = await supabase.from('workflow_steps').insert(steps).select();
    if (stepError) {
      console.error('[dev seeder] failed to insert steps:', stepError);
      return res.status(500).json({ error: 'create-steps-failed', detail: stepError?.message || String(stepError) });
    }

    return res.json({ ok: true, workflow: wf, steps: stepData });
  } catch (e) {
    console.error('[dev seeder] unexpected error:', e?.message || e);
    return res.status(500).json({ error: 'unexpected', detail: e?.message || String(e) });
  }
});

// --- API Route Setup ---

const sendEmailRoute = require('./send_email_route');
app.use('/api', sendEmailRoute);

const { router: referralRouter } = require('./referral_route');
app.use('/api', referralRouter);

// Polar webhook routes
const polarRoutes = require('./routes/polarRoutes');
app.use('/polar-webhook', polarRoutes);

// Execution routes: details, steps, cancel
try {
  const executionRoutes = require('./routes/executionRoutes');
  app.use('/api/executions', authMiddleware, apiLimiter, executionRoutes);
} catch (e) {
  console.warn('[boot] executionRoutes not mounted:', e?.message || e);
}

// Audit logs routes
try {
  const auditLogsRoutes = require('./routes/auditLogs');
  app.use('/api/audit-logs', authMiddleware, apiLimiter, auditLogsRoutes);
} catch (e) {
  console.warn('[boot] auditLogsRoutes not mounted:', e?.message || e);
}

// ROI analytics routes
try {
  const roiAnalyticsRoutes = require('./routes/roiAnalytics');
  app.use('/api/roi-analytics', authMiddleware, apiLimiter, roiAnalyticsRoutes);
} catch (e) {
  console.warn('[boot] roiAnalyticsRoutes not mounted:', e?.message || e);
}

// Start a workflow execution
try {
  const { WorkflowExecutor } = require('./services/workflowExecutor');
  app.post('/api/workflows/execute', authMiddleware, apiLimiter, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const { workflowId, inputData = {}, triggeredBy = 'manual', triggerData = {} } = req.body || {};
      if (!workflowId) return res.status(400).json({ error: 'workflowId is required' });

      const executor = new WorkflowExecutor();
      console.log('[API] execute request', { userId, workflowId, triggeredBy });
      let execution;
      try {
        execution = await executor.startExecution({
          workflowId,
          userId,
          triggeredBy,
          triggerData,
          inputData
        });
      } catch (e) {
        const msg = e?.message || '';
        // Map domain errors to explicit HTTP statuses for clearer client handling
        if (msg.includes('Workflow not found')) {
          console.warn('[API] workflow not found:', { workflowId, userId, message: msg });
          return res.status(404).json({ error: msg });
        }
        if (msg.includes('Workflow is not active')) {
          console.warn('[API] workflow not active:', { workflowId, userId, message: msg });
          return res.status(409).json({ error: msg });
        }
        // For other well-known executor errors that might indicate bad input, map to 400
        if (msg.includes('Invalid') || msg.includes('missing')) {
          return res.status(400).json({ error: msg });
        }
        throw e;
      }

      return res.json({ execution });
    } catch (err) {
      console.error('[API] /api/workflows/execute error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to start execution' });
    }
  });
} catch (e) {
  console.warn('[boot] workflows execute route not mounted:', e?.message || e);
}

// Dev convenience: allow executing workflows without a bearer token in local dev
// Enable by setting DEV_ALLOW_EXECUTE=true and DEV_USER_ID to a valid profile id
if (process.env.NODE_ENV !== 'production' && (process.env.DEV_ALLOW_EXECUTE || '').toLowerCase() === 'true') {
  try {
    const { WorkflowExecutor } = require('./services/workflowExecutor');
    app.post('/api/dev/workflows/execute', apiLimiter, async (req, res) => {
      try {
        const workflowId = req.body?.workflowId;
        if (!workflowId) return res.status(400).json({ error: 'workflowId is required' });
        const devUser = process.env.DEV_USER_ID || null;
        if (!devUser) return res.status(400).json({ error: 'DEV_USER_ID not set in backend .env' });
        const executor = new WorkflowExecutor();
        const execution = await executor.startExecution({ workflowId, userId: devUser, triggeredBy: 'dev-console', inputData: req.body.inputData || {} });
        return res.json({ execution });
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes('Workflow not found')) return res.status(404).json({ error: msg });
        if (msg.includes('Workflow is not active')) return res.status(409).json({ error: msg });
        if (msg.includes('Invalid') || msg.includes('missing')) return res.status(400).json({ error: msg });
        console.error('[dev execute] unexpected error', err);
        return res.status(500).json({ error: 'failed', detail: msg });
      }
    });
    console.log('[dev execute] /api/dev/workflows/execute available in dev');
  } catch (e) {
    console.warn('[dev execute] could not mount dev execute route:', e?.message || e);
  }
}

// Use morgan for detailed, standardized request logging.
// The 'dev' format is great for development, providing color-coded status codes.
app.use(morgan('dev'));

// Serve static files from React build (if it exists)
const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
if (fs.existsSync(reactBuildPath)) {
  app.use('/app', express.static(reactBuildPath));
  app.use('/app/*', (_req, res) => {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Enhanced health check endpoint for database services
app.get('/api/health/databases', async (_req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Test Supabase connection
    try {
      if (supabase) {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        health.services.supabase = {
          status: error ? 'error' : 'healthy',
          configured: true,
          error: error?.message || null,
          url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/\/.*@/, '//***@') : null
        };
      } else {
        health.services.supabase = {
          status: 'not_configured',
          configured: false
        };
      }
    } catch (error) {
      health.services.supabase = {
        status: 'error',
        configured: true,
        error: error.message
      };
    }

    // Test Firebase connection
    try {
      health.services.firebase = await firebaseNotificationService.getHealthStatus();
    } catch (error) {
      health.services.firebase = {
        status: 'error',
        configured: false,
        error: error.message
      };
    }

    // Overall health
    const supabaseHealthy = health.services.supabase.status === 'healthy';
    const firebaseHealthy = health.services.firebase.health?.overall === true;
    
    health.overall = {
      status: supabaseHealthy && firebaseHealthy ? 'healthy' : 'degraded',
      supabase: supabaseHealthy,
      firebase: firebaseHealthy
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      timestamp: new Date().toISOString(),
      overall: { status: 'error' },
      error: error.message
    });
  }
});

// Kafka health endpoint (no auth) to quickly verify broker connectivity and config
app.get('/api/kafka/health', async (_req, res) => {
  try {
    const kafka = getKafkaService();
    const health = await kafka.getHealth();
    res.json({ ok: true, kafka: health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Root route - serve the landing page (prefer React build, fall back to static file)
app.get('/', (_req, res) => {
    const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
    const landingFallback = path.join(__dirname, 'public', 'landing.html');
    if (fs.existsSync(reactBuildPath)) {
        return res.sendFile(path.join(reactBuildPath, 'index.html'));
    }
    if (fs.existsSync(landingFallback)) {
        return res.sendFile(landingFallback);
    }
    return res.type('text').send('Landing page not available');
});

// Start embedded background workers after routes and middleware have been declared
if ((process.env.ENABLE_EMAIL_WORKER || 'true').toLowerCase() === 'true') {
  // Fire and forget; any errors are logged inside the worker loop
  startEmailWorker();
}

// Optional embedded Python automation supervisor
if ((process.env.AUTOMATION_MODE || 'stub') === 'python') {
  let pyProc;
  const startPython = () => {
    if (pyProc) return;
    console.log('[automation-supervisor] launching python automation-service/production_automation_service.py');
    pyProc = spawn('python', ['automation/automation-service/production_automation_service.py'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '7070' }
    });
    pyProc.stdout.on('data', d => process.stdout.write('[automation] ' + d));
    pyProc.stderr.on('data', d => process.stderr.write('[automation:err] ' + d));
    pyProc.on('exit', code => {
      console.warn('[automation-supervisor] python exited code', code);
      pyProc = null;
      setTimeout(startPython, 5000); // restart after delay
    });
  };
  startPython();
  process.on('SIGTERM', () => { if (pyProc) pyProc.kill('SIGTERM'); });
  process.on('SIGINT', () => { if (pyProc) pyProc.kill('SIGINT'); });
}

// Auth route - serve the React auth page
app.get('/auth', (_req, res) => {
    const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
    const authFallback = path.join(__dirname, 'public', 'auth.html');
    if (fs.existsSync(reactBuildPath)) {
        return res.sendFile(path.join(reactBuildPath, 'index.html'));
    }
    if (fs.existsSync(authFallback)) {
        return res.sendFile(authFallback);
    }
    return res.type('text').send('Auth page not available');
});

// Pricing route - serve the React pricing page
app.get('/pricing', (_req, res) => {
  const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
  if (fs.existsSync(reactBuildPath)) {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  } else {
    const pricingFallback = path.join(__dirname, 'public', 'pricing.html');
    if (fs.existsSync(pricingFallback)) return res.sendFile(pricingFallback);
    return res.type('text').send('Pricing page not available');
  }
});

// App route - serve the React app (your existing dashboard)
app.get('/app', (_req, res) => {
  const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
  if (fs.existsSync(reactBuildPath)) {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  } else {
    const appFallback = path.join(__dirname, 'public', 'app.html');
    if (fs.existsSync(appFallback)) return res.sendFile(appFallback);
    return res.type('text').send('App page not available');
  }
});

// --- Public API Routes ---
// Routes that do not require a user to be logged in.

// --- Public API Routes ---

// GET /api/plans - Fetch all available subscription plans
app.get('/api/plans', async (_req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });
    const { data, error } = await supabase.from('plans').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/plans] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plans', details: err.message });
  }
});

// Moved to authenticated section

// Fetch recent logs
app.get('/api/logs', async (req, res) => {
  try {
    if (!supabase) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
  }
});

// --- Auth Middleware (for all subsequent /api routes) ---
// This middleware will protect all API routes defined below it.

app.use('/api', authLimiter, async (req, res, next) => {
  const startTime = Date.now();
  const minDelay = 100; // Minimum delay in ms to prevent timing attacks
  
  try {
    if (!supabase) {
      // Add artificial delay for consistent timing
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const authHeader = (req.get('authorization') || '').trim();
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
    
    if (!token) {
      // Add artificial delay for consistent timing
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // validate token via Supabase server client
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      // Add artificial delay for consistent timing
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // attach user to request for downstream handlers
    req.user = data.user;

    // Ensure minimum delay even for successful auth
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
    return next();

  } catch (err) {
    console.error('[auth middleware] error', err?.message || err);
    // Add artificial delay for consistent timing
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// --- Authenticated API Routes ---
// All routes defined below this point will require a valid JWT.

// --- Authenticated API Routes ---

// Utility functions for security validation

// URL validation function
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    // Block private IPs and localhost
    if (isPrivateIp(parsed.hostname)) return { valid: false, reason: 'private-ip' };
    // Only allow http and https, block ALL others
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { valid: false, reason: 'protocol' };
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'invalid-url' };
  }
}

// Helper function to check private IP ranges
function isPrivateIP(hostname) {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  
  if (match) {
    const [, a, b, c, d] = match.map(Number);
    
    // 10.0.0.0/8
    if (a === 10) return true;
    
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    
    // 127.0.0.0/8
    if (a === 127) return true;
    
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
  }
  
  return false;
}

// Error sanitization function to prevent information disclosure
function sanitizeError(error, isDevelopment = false) {
  if (!error) return 'Unknown error occurred';
  
  // In development, show more details (but still filtered)
  if (isDevelopment && process.env.NODE_ENV !== 'production') {
    const message = typeof error === 'string' ? error : (error.message || 'Unknown error');
    // Remove sensitive patterns
    return message
      .replace(/password|secret|key|token/gi, '[REDACTED]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
      .substring(0, 200); // Limit length
  }
  
  // In production, return generic messages
  const errorType = typeof error === 'string' ? error : (error.name || 'Error');
  const genericErrors = {
    'ValidationError': 'Invalid input provided',
    'CastError': 'Invalid data format',
    'MongoError': 'Database operation failed',
    'SequelizeError': 'Database operation failed',
    'TypeError': 'Invalid operation',
    'SyntaxError': 'Invalid request format',
    'ReferenceError': 'Resource not found',
    'NetworkError': 'Network operation failed',
    'TimeoutError': 'Operation timed out'
  };
  
  return genericErrors[errorType] || 'Internal server error';
}

// Add this function before the route handlers (around line 500)

// Implementation of task run queueing and processing
async function queueTaskRun(runId, taskData) {
  try {
    console.log(`[queueTaskRun] Queueing automation run ${runId}`);
    
    // Get the automation worker URL from environment
    const automationUrl = process.env.AUTOMATION_URL;
    if (!automationUrl) {
      throw new Error('AUTOMATION_URL environment variable is required');
    }
    
    // Prepare the payload for the automation worker
    const payload = { 
      url: taskData.url,
      title: taskData.title || 'Untitled Task',
      run_id: runId,
      task_id: taskData.task_id,
      user_id: taskData.user_id,
      type: taskData.task_type || taskData.type || 'general',
      parameters: taskData.parameters || {}
    };
    
    console.log(`[queueTaskRun] Sending to automation service: ${automationUrl}`);
    
    // Call the real automation service
    try {
      let automationResult;
      let response = null;
      
      {
        // Ensure URL has protocol; accept values like 'localhost:5001' and normalize to 'http://localhost:5001'
        let normalizedUrl = automationUrl;
        if (!/^https?:\/\//i.test(normalizedUrl)) {
          normalizedUrl = `http://${normalizedUrl}`;
        }
        // Ensure no accidental whitespace
        normalizedUrl = normalizedUrl.trim();
        // Try type-specific endpoints first, then fall back to generic /automate
        const taskTypeSlug = String(payload.type || 'general').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
        const candidates = [
          `/automate/${encodeURIComponent(taskTypeSlug)}`,
          `/${encodeURIComponent(taskTypeSlug)}`,
          '/automate'
        ];

        let lastError;
        for (const pathSuffix of candidates) {
          const base = normalizedUrl.replace(/\/$/, '');
          const fullAutomationUrl = `${base}${pathSuffix}`;
          console.log(`[queueTaskRun] Trying automation endpoint: ${fullAutomationUrl}`);
          try {
            const headers = { 'Content-Type': 'application/json' };
            if (process.env.AUTOMATION_API_KEY) {
              headers['Authorization'] = `Bearer ${process.env.AUTOMATION_API_KEY}`;
            }
            response = await axios.post(fullAutomationUrl, payload, {
              timeout: 30000,
              headers
            });
            automationResult = response.data || { message: 'Execution completed with no data returned' };
            console.log(`[queueTaskRun] Automation service response (${pathSuffix}):`,
              response.status, response.data ? 'data received' : 'no data');
            break;
          } catch (err) {
            lastError = err;
            console.warn(`[queueTaskRun] Endpoint ${pathSuffix} failed:`, err?.response?.status || err?.message || err);
          }
        }
        if (!automationResult && lastError) throw lastError;
      }
      
      // Update the run with the result
      const sb = (typeof global !== 'undefined' && global.supabase) ? global.supabase : supabase;
    await sb
        .from('automation_runs')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
      result: automationResult
        })
        .eq('id', runId);

      // Track the completed automation run
  await usageTracker.trackAutomationRun(taskData.user_id, runId, 'completed');

      // Send notification for task completion
      try {
        const taskName = taskData.title || 'Automation Task';
        const notification = NotificationTemplates.taskCompleted(taskName);
        await firebaseNotificationService.sendAndStoreNotification(taskData.user_id, notification);
        console.log(`🔔 Task completion notification sent to user ${taskData.user_id}`);
      } catch (notificationError) {
        console.error('🔔 Failed to send task completion notification:', notificationError.message);
      }
        
  return response?.data ?? automationResult;
    } catch (error) {
      console.error(`[queueTaskRun] Automation service error:`, error.message);
      
      // Update the run with the error
  const sb2 = (typeof global !== 'undefined' && global.supabase) ? global.supabase : supabase;
  await sb2
        .from('automation_runs')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          result: JSON.stringify({ 
            error: 'Automation execution failed',
            message: error.message || 'Unknown error'
          })
        })
        .eq('id', runId);

      // Track the failed automation run (failed runs don't count towards monthly quota)
  await usageTracker.trackAutomationRun(taskData.user_id, runId, 'failed');

      // Send notification for task failure
      try {
        const taskName = taskData.title || 'Automation Task';
        const notification = NotificationTemplates.taskFailed(taskName, error.message || 'Unknown error');
        await firebaseNotificationService.sendAndStoreNotification(taskData.user_id, notification);
        console.log(`🔔 Task failure notification sent to user ${taskData.user_id}`);
      } catch (notificationError) {
        console.error('🔔 Failed to send task failure notification:', notificationError.message);
      }
        
      throw error;
    }
  } catch (error) {
    console.error(`[queueTaskRun] Error: ${error.message || error}`);
    
    // Make sure the run is marked as failed if we get an unexpected error
    try {
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          result: JSON.stringify({ error: error.message || 'Unknown error' })
        })
        .eq('id', runId);
    } catch (updateError) {
      console.error(`[queueTaskRun] Failed to update run status: ${updateError.message}`);
    }
    
    throw error;
  }
}

// Comprehensive input sanitization function
function sanitizeInput(input) {
  let sanitized = typeof input === 'string' ? input : String(input ?? '');
  sanitized = sanitized
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove vbscript: protocol  
    .replace(/vbscript:/gi, '')
    // Remove data: protocol (can contain scripts)
    .replace(/data:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove style attributes (CSS injection)
    .replace(/style\s*=/gi, '')
    // Remove expression() in CSS
    .replace(/expression\s*\(/gi, '')
    // Remove import and @import
    .replace(/@import/gi, '')
    // Remove HTML comments that could contain scripts
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove CDATA sections
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    // Remove iframe, object, embed, form, meta, link tags
    .replace(/<(iframe|object|embed|form|meta|link)[^>]*>/gi, '')
    // Remove closing tags for dangerous elements
    .replace(/<\/(iframe|object|embed|form|meta|link)>/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  // Enforce max length 1000 always
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  return sanitized;
}

// Credential encryption
function encryptCredentials(credentials, key) {
  if (!key || typeof key !== 'string' || key.length < 16) {
    throw new Error('Encryption key must be at least 16 characters long');
  }
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(32); // Generate random salt
  const keyBuffer = crypto.scryptSync(key, salt, 32); // Use random salt
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'), // Include salt in output
    authTag: authTag.toString('hex'),
    algorithm
  };
}

function decryptCredentials(encryptedData, key) {
  const salt = Buffer.from(encryptedData.salt, 'hex'); // Use stored salt
  const keyBuffer = crypto.scryptSync(key, salt, 32); // Derive key with original salt
  const decipher = crypto.createDecipheriv(
    encryptedData.algorithm || 'aes-256-gcm',
    keyBuffer,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// POST /api/run-task - Secured automation endpoint
app.post('/api/run-task', authMiddleware, automationLimiter, async (req, res) => {
  const { url, title, notes, type, task, username, password, pdf_url } = req.body;
  const user = req.user;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    console.log(`[run-task] Processing automation for user ${user.id}`);
    
    // First, create or find a task in automation_tasks
  const taskName = title || (type && type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || (task && task.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || 'Automation Task';
  const taskType = (type || task || 'general').toLowerCase();
    
    const { data: taskRecord, error: taskError } = await supabase
      .from('automation_tasks')
      .insert([{
        user_id: user.id,
        name: taskName,
        description: notes || '',
        url: url,
        task_type: taskType,
        parameters: JSON.stringify({ 
          notes: notes || '', 
          username: username || '',
          password: password || '',
          pdf_url: pdf_url || ''
        })
      }])
      .select()
      .single();
    
    if (taskError) {
      console.error('[run-task] Error creating automation task:', taskError);
      return res.status(500).json({ error: 'Failed to create automation task' });
    }
    
    // Now create a run record in automation_runs
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert([{
        task_id: taskRecord.id,
        user_id: user.id,
        status: 'running',  // Valid statuses: 'running', 'completed', 'failed'
        started_at: new Date().toISOString(),
        result: JSON.stringify({ status: 'started' })
      }])
      .select()
      .single();
    
    if (runError) {
      console.error('[run-task] Error creating automation run:', runError);
      return res.status(500).json({ error: 'Failed to create automation run' });
    }
    
  // Queue the task processing in the background to avoid request timeouts
    // Respond immediately; background worker will update run status and send notifications
    setImmediate(async () => {
      try {
        // Parse parameters back to object for worker payload
        let paramsObj = {};
        try {
          paramsObj = taskRecord?.parameters ? JSON.parse(taskRecord.parameters) : {};
        } catch (_) {}
        await queueTaskRun(run.id, {
          url,
          title: taskName,
          task_id: taskRecord.id,
          user_id: user.id,
          task_type: taskType,
          parameters: paramsObj
        });
      } catch (error) {
        console.error('[run-task background] Error processing run', run.id, error?.message || error);
        try {
          await supabase
            .from('automation_runs')
            .update({
              status: 'failed',
              ended_at: new Date().toISOString(),
              result: JSON.stringify({ error: 'Background processing failed', message: error?.message || String(error) })
            })
            .eq('id', run.id);
        } catch (updateErr) {
          console.error('[run-task background] Failed to mark run failed:', updateErr?.message || updateErr);
        }
      }
    });

    return res.status(200).json({
      id: run.id,
      status: 'queued',
      message: 'Task queued for processing'
    });
    
  } catch (error) {
    console.error('[run-task] Unhandled error:', error.message || error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

// Automation health/config endpoint for quick diagnostics
app.get('/api/health/automation', async (_req, res) => {
  const automationUrl = process.env.AUTOMATION_URL;
  if (!automationUrl) {
    return res.status(500).json({ ok: false, error: 'AUTOMATION_URL not configured' });
  }
  
  try {
    // Health probe on automation worker
    const url = (automationUrl.startsWith('http') ? automationUrl : `http://${automationUrl}`).replace(/\/$/, '') + '/health';
    const { data } = await axios.get(url, { timeout: 3000 });
    return res.json({ ok: true, target: automationUrl, worker: data });
  } catch (e) {
    return res.status(200).json({ ok: false, target: automationUrl, error: e?.message || String(e) });
  }
});

// Poll automation task status/result by task_id (must be after app and middleware setup)
app.get('/api/automation/status/:task_id', authMiddleware, async (req, res) => {
  const { task_id } = req.params;
  if (!task_id) {
    return res.status(400).json({ error: 'Missing task_id parameter.' });
  }
  const status = taskStatusStore.get(task_id);
  if (!status) {
    return res.status(404).json({ error: 'Task not found or expired.' });
  }
  // Only allow the user who submitted the task to view status
  if (status.user_id && status.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this task.' });
  }
  res.json({
    task_id,
    status: status.status,
    result: status.result,
    updated_at: status.updated_at
  });
});

// POST /api/notifications/create - server-side notification creation & optional push
app.post('/api/notifications/create', authMiddleware, async (req, res) => {
  try {
    const { type, title, body, priority = 'normal', data = {} } = req.body || {};
    if (!type || !title || !body) {
      return res.status(400).json({ error: 'type, title and body are required' });
    }

    const notification = { type, title, body, priority, data };

    if (!firebaseNotificationService || !firebaseNotificationService.isConfigured) {
      console.warn('[POST /api/notifications/create] Firebase not fully configured; attempting store only');
    }

    const result = await firebaseNotificationService.sendAndStoreNotification(req.user.id, notification);

    if (!result.store.success) {
      return res.status(500).json({
        error: 'Failed to store notification',
        store_error: result.store.error,
        push_error: result.push?.error || null
      });
    }

    res.json({
      success: true,
      notification_id: result.store.notificationId,
      push: result.push,
      stored: result.store
    });
  } catch (error) {
    console.error('[POST /api/notifications/create] error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// --- Task Management API ---

// GET /api/tasks - Fetch all automation tasks for the user
app.get('/api/tasks', async (req, res) => {
  try {
    // Defensive check to ensure auth middleware has attached the user.
    if (!req.user || !req.user.id) {
      console.error('[GET /api/tasks] Error: req.user is not defined. This indicates the Authorization header is missing or was stripped by a proxy.');
      // Log headers for debugging, but be careful with sensitive data in production logs.
      console.error('[GET /api/tasks] Request Headers:', JSON.stringify(req.headers));
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const { data, error } = await supabase
      .from('automation_tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/tasks] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
});

// POST /api/tasks - Create a new automation task
app.post('/api/tasks', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    // --- Plan Limit Enforcement ---
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      // Fallback or error - for now, let's deny if no active subscription is found
      // This could be changed to allow for a default/free plan
      return res.status(403).json({ error: 'No active subscription found.' });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('feature_flags')
      .eq('id', subscription.plan_id)
      .single();

    if (planError) return res.status(500).json({ error: 'Could not verify plan limits.' });

    const maxWorkflows = plan.feature_flags?.max_workflows;

    if (maxWorkflows !== -1) { // -1 signifies unlimited
      const { count, error: countError } = await supabase
        .from('automation_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (countError) return res.status(500).json({ error: 'Could not count existing tasks.' });

      if (count >= maxWorkflows) {
        return res.status(403).json({ error: 'You have reached your workflow limit. Please upgrade your plan.' });
      }
    }
    // --- End Limit Enforcement ---

    const { name, description, url, parameters } = req.body;
    if (!name || !url) {
      return res.status(400).json({ error: 'Task name and URL are required' });
    }

    const { data, error } = await supabase
      .from('automation_tasks')
      .insert([
        {
          user_id: req.user.id,
          name,
          description,
          url,
          parameters: parameters || {},
        },
      ])
      .select();

    if (error) throw error;

    // Track the new workflow creation
    await usageTracker.trackWorkflowChange(req.user.id, data[0].id, 'created');

    res.status(201).json(data[0]);
  } catch (err) {
    console.error('[POST /api/tasks] Error:', err.message);
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// POST /api/tasks/:id/run - Run a specific task and log it
app.post('/api/tasks/:id/run', async (req, res) => {
  const taskId = req.params.id;
  let runId;

  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    // --- Plan Limit Enforcement ---
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(403).json({ error: 'No active subscription found.' });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('feature_flags')
      .eq('id', subscription.plan_id)
      .single();

    if (planError) return res.status(500).json({ error: 'Could not verify plan limits.' });

    const maxRuns = plan.feature_flags?.max_runs_per_month;

    if (maxRuns !== -1) {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      const { count, error: countError } = await supabase
        .from('automation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .gte('created_at', startDate);

      if (countError) return res.status(500).json({ error: 'Could not count recent runs.' });

      if (count >= maxRuns) {
        return res.status(403).json({ error: 'You have reached your monthly run limit. Please upgrade your plan.' });
      }
    }
    // --- End Limit Enforcement ---

    // 1. Fetch the task details
    const { data: task, error: taskError } = await supabase
      .from('automation_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', req.user.id)
      .single();

    if (taskError) throw new Error('Task not found or permission denied.');
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // 2. Create a new record in automation_runs
    const { data: runData, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        task_id: taskId,
        user_id: req.user.id,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) throw runError;
    runId = runData.id;

    // 3. Call the automation worker
    const automationUrl = process.env.AUTOMATION_URL;
    if (!automationUrl) {
      throw new Error('AUTOMATION_URL environment variable is required');
    }
    const payload = { 
      url: task.url, 
      username: task.parameters?.username, 
      password: task.parameters?.password,
      pdf_url: task.parameters?.pdf_url
    };
    
    const response = await axios.post(automationUrl, payload, { timeout: 120000 });
    const result = response.data?.result ?? null;

    // Add detailed logging for the result from the automation service
    console.log(`[POST /api/tasks/${taskId}/run] Received result from automation service:`, JSON.stringify(result, null, 2));

    // 4. Update the run record with the result
    const { error: updateError } = await supabase
      .from('automation_runs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        result: { message: 'Execution finished.', output: result }, // The result from the automation service is saved here
      })
      .eq('id', runId);

    // Track the completed automation run
    await usageTracker.trackAutomationRun(req.user.id, runId, 'completed');

    if (updateError) throw updateError;

    // Send task completion notification
    try {
      const notification = NotificationTemplates.taskCompleted(taskData.name);
      await firebaseNotificationService.sendAndStoreNotification(req.user.id, notification);
      console.log(`🔔 Task completion notification sent for task ${taskData.name} to user ${req.user.id}`);
    } catch (notificationError) {
      console.error('🔔 Failed to send task completion notification:', notificationError.message);
    }

    res.json({ message: 'Task executed successfully', runId, result });

  } catch (err) {
    // Log the full error object for more detailed debugging information.
    console.error(`[POST /api/tasks/${taskId}/run] Error:`, err);

    // 5. If an error occurred, update the run record to 'failed'
    if (runId) {
      try {
        // Create a structured error payload for the database.
        const errorPayload = {
          error: 'Task execution failed.',
          message: err.message,
          details: err.response?.data || null, // Capture details from axios error response if available.
        };
        await supabase
          .from('automation_runs')
          .update({
            status: 'failed',
            ended_at: new Date().toISOString(),
            result: errorPayload,
          })
          .eq('id', runId);

        // Track the failed automation run (failed runs don't count towards monthly quota)
        await usageTracker.trackAutomationRun(req.user.id, runId, 'failed');

        // Send task failure notification
        try {
          const notification = NotificationTemplates.taskFailed(taskData.name, err.message);
          await firebaseNotificationService.sendAndStoreNotification(req.user.id, notification);
          console.log(`🔔 Task failure notification sent for task ${taskData.name} to user ${req.user.id}`);
        } catch (notificationError) {
          console.error('🔔 Failed to send task failure notification:', notificationError.message);
        }
      } catch (dbErr) {
        // Log the full database error for better diagnostics if the failure update itself fails.
        console.error(`[POST /api/tasks/${taskId}/run] DB error update failed:`, dbErr);
      }
    }
    
    // Return a more structured error response to the client.
    res.status(500).json({ error: 'Failed to run task', details: err.message, runId: runId || null });
  }
});

// GET /api/runs - Fetch all automation runs for the user
app.get('/api/runs', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const { data, error } = await supabase
      .from('automation_runs')
      .select(`
        id,
        status,
        started_at,
        ended_at,
        result,
        automation_tasks ( name, url )
      `)
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/runs] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch runs', details: err.message });
  }
});

// GET /api/dashboard - Fetch dashboard statistics
app.get('/api/dashboard', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const userId = req.user.id;

    // Perform all queries in parallel for efficiency
    const [tasksCount, runsCount, recentRuns] = await Promise.all([
      supabase.from('automation_tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('automation_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('automation_runs').select('id, status, started_at, automation_tasks(name)').eq('user_id', userId).order('started_at', { ascending: false }).limit(5)
    ]);

    if (tasksCount.error) throw tasksCount.error;
    if (runsCount.error) throw runsCount.error;
    if (recentRuns.error) throw recentRuns.error;

    res.json({
      totalTasks: tasksCount.count,
      totalRuns: runsCount.count,
      recentRuns: recentRuns.data,
    });

  } catch (err) {
    console.error('[GET /api/dashboard] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: err.message });
  }
});

// DELETE /api/tasks/:id - Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const { error } = await supabase
      .from('automation_tasks')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    // Track the workflow deletion
    await usageTracker.trackWorkflowChange(req.user.id, req.params.id, 'deleted');

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (err) {
    console.error(`[DELETE /api/tasks/${req.params.id}] Error:`, err.message);
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

// GET /api/usage/debug - Debug user usage data
app.get('/api/usage/debug', authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log(`[DEBUG] Checking usage for user: ${req.user.id}`);

    // Check if user_usage table exists
    let tableExists = false;
    try {
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', req.user.id)
        .single();
      
      tableExists = !usageError || usageError.code !== '42P01';
      console.log(`[DEBUG] user_usage table exists: ${tableExists}`);
      console.log(`[DEBUG] Current usage record:`, usageData);
    } catch (e) {
      console.log(`[DEBUG] user_usage table check error:`, e.message);
    }

    // Check automation runs
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: runs, count: runsCount, error: runsError } = await supabase
      .from('automation_runs')
      .select('id, status, created_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .gte('created_at', startOfMonth.toISOString());

    const completedRuns = runs?.filter(run => run.status === 'completed').length || 0;

    // Check workflows
    const { data: workflows, count: workflowsCount, error: workflowsError } = await supabase
      .from('automation_tasks')
      .select('id, name, is_active', { count: 'exact' })
      .eq('user_id', req.user.id);

    const activeWorkflows = workflows?.filter(wf => wf.is_active !== false).length || 0;

    // Check plan details
    const { data: planData, error: planError } = await supabase
      .rpc('get_user_plan_details', { user_uuid: req.user.id });

    res.json({
      user_id: req.user.id,
      table_exists: tableExists,
      raw_data: {
        total_runs: runsCount || 0,
        completed_runs_this_month: completedRuns,
        total_workflows: workflowsCount || 0,
        active_workflows: activeWorkflows,
        runs_data: runs?.slice(0, 5), // Show first 5 runs
        workflows_data: workflows?.slice(0, 5) // Show first 5 workflows
      },
      plan_function_result: planData,
      errors: {
        runs_error: runsError,
        workflows_error: workflowsError,
        plan_error: planError
      }
    });

  } catch (error) {
    console.error('[GET /api/usage/debug] Error:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
});

// GET /api/usage/refresh - Refresh user usage metrics
app.post('/api/usage/refresh', authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Calculate real usage data from database
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [runsResult, workflowsResult] = await Promise.all([
      // Count completed automation runs this month
      supabase
        .from('automation_runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString()),
      
      // Count active workflows
      supabase
        .from('automation_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .or('is_active.is.null,is_active.eq.true')
    ]);

    const monthlyRuns = runsResult.count || 0;
    const workflows = workflowsResult.count || 0;

    // Update or create usage record
    const { error: upsertError } = await supabase
      .from('user_usage')
      .upsert({
        user_id: req.user.id,
        monthly_runs: monthlyRuns,
        workflows: workflows,
        storage_gb: 0, // Will be calculated properly with storage tracking
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('[POST /api/usage/refresh] Upsert error:', upsertError);
    }

    // Also use the usage tracker for future
    await usageTracker.refreshAllUserUsage(req.user.id);
    
    res.json({
      success: true,
      usage: {
        monthly_runs: monthlyRuns,
        workflows: workflows,
        storage_gb: 0
      },
      refreshed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[POST /api/usage/refresh] Error:', error);
    res.status(500).json({ error: 'Failed to refresh usage data' });
  }
});

// GET /api/subscription - Fetch user's current subscription and usage
app.get('/api/subscription', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', req.user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (subError) {
      // It's okay if no subscription is found, might be a free user.
      return res.json({ subscription: null, usage: { tasks: 0, runs: 0 } });
    }

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [tasksCount, runsCount] = await Promise.all([
      supabase.from('automation_tasks').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id),
      supabase.from('automation_runs').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).gte('created_at', monthStart)
    ]);

    res.json({
      subscription,
      usage: {
        tasks: tasksCount.count || 0,
        runs: runsCount.count || 0,
      }
    });

  } catch (err) {
    console.error('[GET /api/subscription] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription data', details: err.message });
  }
});

// GET /api/schedules - Fetch workflow schedules for the authenticated user
app.get('/api/schedules', authMiddleware, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { data: schedules, error } = await supabase
      .from('workflow_schedules')
      .select(`
        id,
        workflow_id,
        schedule_type,
        cron_expression,
        interval_seconds,
        timezone,
        is_active,
        next_trigger_at,
        execution_count,
        max_executions,
        created_at,
        updated_at,
        workflow:workflows (
          id,
          name,
          description
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/schedules] Database error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch schedules',
        details: error.message 
      });
    }

    res.json(schedules || []);
  } catch (err) {
    console.error('[GET /api/schedules] Error:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch schedules', 
      details: err.message 
    });
  }
});

// --- Marketing & growth endpoints -------------------------------------------------
// Track arbitrary marketing/product events server-side
app.post('/api/track-event', async (req, res) => {
  try {
    const { user_id, event_name, properties, utm } = req.body || {};
    if (!event_name) return res.status(400).json({ error: 'event_name is required' });

    if (supabase) {
      await supabase.from('marketing_events').insert([{ user_id: user_id || null, event_name, properties: properties || {}, utm: utm || {}, created_at: new Date().toISOString() }]);
    }

    // Optionally forward to external analytics asynchronously
    (async () => {
      try {
        if (process.env.MIXPANEL_TOKEN && process.env.NODE_ENV !== 'test') {
          // Basic Mixpanel HTTP ingestion (lite) - non-blocking
          const mp = {
            event: event_name,
            properties: Object.assign({ token: process.env.MIXPANEL_TOKEN, distinct_id: user_id || null, time: Math.floor(Date.now() / 1000) }, properties || {}, { utm: utm || {} }),
          };
          await axios.post('https://api.mixpanel.com/track', { data: Buffer.from(JSON.stringify([mp])).toString('base64') }, { timeout: 3000 });
        }
      } catch (e) {
        console.warn('[track-event] forward failed', e?.message || e);
      }
    })();

    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/track-event] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Enqueue a transactional/marketing email (worker will process)
app.post('/api/enqueue-email', async (req, res) => {
  try {
    const { to_email, template, data, scheduled_at } = req.body || {};
    if (!to_email || !template) return res.status(400).json({ error: 'to_email and template are required' });
    if (!supabase) return res.status(500).json({ error: 'server misconfigured' });
    const when = scheduled_at ? new Date(scheduled_at).toISOString() : new Date().toISOString();

// Match the email_queue schema: use `template` and `data` (JSON) fields.
    const emailData = {
      profile_id: req.user?.id || null,
      to_email,
      template,
      data: data || {},
      scheduled_at: when,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('email_queue').insert([emailData]);
    if (error) {
      // Log full error object for debugging
      console.error('[enqueue-email] db error', JSON.stringify(error, null, 2));
      // In non-production show details to help diagnose; DO NOT enable this in production
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ error: 'db error', details: error });
      }
      return res.status(500).json({ error: 'db error' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/enqueue-email] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

async function ensureUserProfile(userId, email) {
  try {
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (!existingProfile) {
      console.log(`[ensureUserProfile] Creating missing profile for user ${userId}, email: ${email}`);
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: email,
          created_at: new Date().toISOString()
        }]);
      
      if (insertError) {
        console.error('[ensureUserProfile] Failed to create profile:', insertError);
        throw insertError;
      }
      console.log(`[ensureUserProfile] Successfully created profile for user ${userId}`);
    }
    return true;
  } catch (error) {
    console.error('[ensureUserProfile] Error:', error);
    throw error;
  }
}

// Trigger a small campaign sequence for the authenticated user (example: welcome series)
app.post('/api/trigger-campaign', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) {
      console.log('[trigger-campaign] No user found on request');
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }
    const { campaign, to_email } = req.body || {};
    console.log(`[trigger-campaign] Received request: campaign=${campaign}, to_email=${to_email}, user_id=${req.user.id}`);
    if (!campaign) {
      console.log('[trigger-campaign] No campaign specified');
      return res.status(400).json({ error: 'campaign is required' });
    }

    // Enhanced email lookup with multiple strategies
    let targetEmail = to_email || null;
    if (!targetEmail) {
      console.log('[trigger-campaign] Looking up user email - trying multiple sources...');
      
      // Strategy 1: Try profiles table (existing logic)
      try {
        if (supabase) {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', req.user.id)
            .maybeSingle();
          console.log('[trigger-campaign] Profile lookup result:', { profile, pErr });
          if (pErr) console.warn('[trigger-campaign] profile lookup error', pErr.message || pErr);
          if (profile && profile.email) {
            targetEmail = profile.email;
            console.log(`[trigger-campaign] Found target email from profile: ${targetEmail}`);
          } else {
            console.log('[trigger-campaign] No email found in profiles table');
          }
        }
      } catch (e) {
        console.warn('[trigger-campaign] profile lookup failed', e?.message || e);
      }
    }
    
    // Strategy 2: Try auth.users table if still no email
    if (!targetEmail && supabase) {
      try {
        console.log('[trigger-campaign] Trying auth.users table...');
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(req.user.id);
        
        if (authUser && authUser.user && authUser.user.email) {
          targetEmail = authUser.user.email;
          console.log('[trigger-campaign] Found email in auth.users:', targetEmail);
        } else {
          console.log('[trigger-campaign] No email in auth.users');
        }
      } catch (e) {
        console.log('[trigger-campaign] Auth.users lookup failed:', e.message);
      }
    }
    
    // Strategy 3: Try req.user.email directly
    if (!targetEmail && req.user.email) {
      targetEmail = req.user.email;
      console.log('[trigger-campaign] Using email from req.user:', targetEmail);
    }
    
    // Strategy 4: Try user_metadata
    if (!targetEmail && req.user.user_metadata && req.user.user_metadata.email) {
      targetEmail = req.user.user_metadata.email;
      console.log('[trigger-campaign] Using email from user_metadata:', targetEmail);
    }

    // Strategy 5: Debug user object to see available data
    if (!targetEmail) {
      console.log('[trigger-campaign] Available user data:', JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        user_metadata: req.user.user_metadata,
        app_metadata: req.user.app_metadata,
        aud: req.user.aud,
        role: req.user.role
      }, null, 2));
    }

    if (!targetEmail) {
      console.log('[trigger-campaign] Target email not found after all strategies');
      return res.status(400).json({ 
        error: 'target email not found',
        debug: 'User authenticated but no email address found in profiles, auth.users, or user object'
      });
    }

    try {
  await ensureUserProfile(req.user.id, targetEmail);
} catch (profileError) {
  console.error('[trigger-campaign] Failed to ensure user profile:', profileError);
  return res.status(500).json({ 
    error: 'Failed to prepare user profile for email campaign',
    note: 'User profile creation failed'
  });
}

    console.log(`[trigger-campaign] Final target email: ${targetEmail}`);

    // Add contact to HubSpot in the background (fire-and-forget), but not during tests.
    if (process.env.HUBSPOT_API_KEY && process.env.NODE_ENV !== 'test') {
      (async () => {
        try {
          const hubspotPayload = {
            properties: {
              email: targetEmail,
              lifecyclestage: 'lead',
              record_source: 'EasyFlow SaaS',
            },
          };
          console.log(`[trigger-campaign] Creating contact in HubSpot: ${targetEmail}`, hubspotPayload);
          const hubspotRes = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts',
            hubspotPayload,
            {
              headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log(`[trigger-campaign] Successfully created contact ${targetEmail} in HubSpot. Response:`, hubspotRes.status, hubspotRes.data);
        } catch (hubspotError) {
          console.error('[trigger-campaign] HubSpot error:', hubspotError?.response?.status, hubspotError?.response?.data, hubspotError.message);
          // If contact already exists (409), update them instead.
          if (hubspotError.response?.status === 409 && hubspotError.response?.data?.message) {
            console.log(`[trigger-campaign] Contact ${targetEmail} already exists. Attempting update.`);
            try {
              // Extract contact ID from the error message
              const message = hubspotError.response.data.message;
              const contactIdMatch = message.match(/Existing contact id: (\d+)/);
              const contactId = contactIdMatch ? contactIdMatch[1] : null;

              if (contactId) {
                // Properties to update on the existing contact
                const updatePayload = {
                  properties: {
                    lifecyclestage: 'lead',
                    record_source: 'EasyFlow SaaS',
                  },
                };
                console.log(`[trigger-campaign] Updating contact in HubSpot: ${contactId}`, updatePayload);
                const updateRes = await axios.patch(
                  `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
                  updatePayload,
                  {
                    headers: {
                      'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                console.log(`[trigger-campaign] Successfully updated contact ${targetEmail} in HubSpot. Response:`, updateRes.status, updateRes.data);
              } else {
                console.warn(`[trigger-campaign] Failed to parse contact ID from HubSpot error: ${message}`);
              }
            } catch (updateError) {
              console.error(`[trigger-campaign] Failed to update contact ${targetEmail} in HubSpot:`, updateError.message, updateError?.response?.data);
            }
          } else {
            console.error(`[trigger-campaign] Failed to create contact ${targetEmail} in HubSpot:`, hubspotError.message, hubspotError?.response?.data);
          }
        }
      })();
    }

    // Now, enqueue the emails for the campaign
    const now = new Date();
    const followup = new Date();
    followup.setHours(followup.getHours() + 24); // Schedule followup 24 hours later

    const inserts = [];

    switch (campaign) {
      case 'welcome':
        inserts.push({
          profile_id: req.user.id,
          to_email: targetEmail,
          template: 'welcome',
          data: { profile_id: req.user.id },
          scheduled_at: now.toISOString(),
          status: 'pending',
          created_at: now.toISOString(),
        });
        inserts.push({
          profile_id: req.user.id,
          to_email: targetEmail,
          template: 'welcome_followup',
          data: { profile_id: req.user.id },
          scheduled_at: followup.toISOString(),
          status: 'pending',
          created_at: now.toISOString(),
        });
        console.log(`[trigger-campaign] Enqueuing welcome and followup emails for ${targetEmail}`, inserts);
        break;
      default:
        // Handle other campaigns if you add them
        console.log(`[trigger-campaign] Unknown campaign: ${campaign}`);
        break;
    }

    if (inserts.length > 0 && supabase) {
      const { error } = await supabase
        .from('email_queue')
        .insert(inserts);

      if (error) {
        console.error('[trigger-campaign] DB insert failed:', error.message, error);
        return res.status(500).json({ error: 'Failed to enqueue emails.', note: 'Failed to enqueue emails.' });
      }
      console.log(`[trigger-campaign] Successfully enqueued ${inserts.length} emails for campaign ${campaign}`);
      
      // Send welcome notification
      if (campaign === 'welcome') {
        try {
          // Get user info for personalized notification
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', req.user.id)
            .single();
            
          const userName = profile?.email?.split('@')[0] || 'there';
          const notification = NotificationTemplates.welcome(userName);
          await firebaseNotificationService.sendAndStoreNotification(req.user.id, notification);
          console.log(`🔔 Welcome notification sent to user ${req.user.id}`);
        } catch (notificationError) {
          console.error('🔔 Failed to send welcome notification:', notificationError.message);
        }
      }
    } else if (!supabase) {
      console.warn('[trigger-campaign] No Supabase client available - emails not enqueued');
    } else {
      console.log(`[trigger-campaign] No emails enqueued for campaign ${campaign}`);
    }

    return res.json({ ok: true, enqueued: inserts.length });
  } catch (e) {
    console.error('[POST /api/trigger-campaign] error', e?.message || e, e);
    return res.status(500).json({ error: 'internal', enqueued: 0, note: e.message || 'No additional error note provided.' });
  }
});

// Kafka-based automation endpoints
const kafkaService = getKafkaService();

// Health check endpoint for the backend
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'backend',
    version: '1.0.0'
  });
});

// Kafka health endpoint
app.get('/api/kafka/health', async (req, res) => {
  try {
    const health = await kafkaService.getHealth();
    res.json({
      kafka: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      error: 'Kafka service unavailable',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Queue automation task via Kafka (fire-and-forget)
app.post('/api/automation/queue', authMiddleware, automationLimiter, async (req, res) => {
  try {
    const taskData = req.body;
    
    if (!taskData || !taskData.task_type) {
      return res.status(400).json({ 
        error: 'task_type is required',
        accepted_types: ['web_automation', 'form_submission', 'data_extraction', 'file_download']
      });
    }
    
    // Add user context to task
    const enrichedTask = {
      ...taskData,
      user_id: req.user.id,
      created_at: new Date().toISOString(),
      source: 'backend-api'
    };
    
    const result = await kafkaService.sendAutomationTask(enrichedTask);
    
    res.status(202).json({
      success: true,
      task_id: result.taskId,
      message: 'Task queued successfully',
      status: 'queued'
    });
    
  } catch (error) {
    console.error('[POST /api/automation/queue] error:', error);
    res.status(500).json({
      error: 'Failed to queue automation task',
      details: error.message
    });
  }
});

//
// Expected payload for /api/automation/execute:
// {
//   task_type: 'web_automation' | 'form_submission' | 'data_extraction' | 'file_download',
//   url: string, // required for most types
//   username?: string,
//   password?: string,
//   pdf_url?: string,
//   ...other task-specific fields
// }
//

app.post('/api/automation/execute', authMiddleware, automationLimiter, async (req, res) => {
  try {
    const taskData = req.body;

    // DEV: Log incoming payload for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV DEBUG] Incoming /api/automation/execute payload:', JSON.stringify(taskData, null, 2));
    }

    // Validate payload
    if (!taskData || typeof taskData !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV DEBUG] Missing or invalid request body:', taskData);
      }
      return res.status(400).json({
        error: 'Request body must be a JSON object with required fields.'
      });
    }
    if (!taskData.task_type) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV DEBUG] Missing task_type in request body:', taskData);
      }
      return res.status(400).json({
        error: 'task_type is required',
        accepted_types: ['web_automation', 'form_submission', 'data_extraction', 'file_download']
      });
    }
    if (!taskData.url && ['web_automation', 'form_submission', 'data_extraction', 'file_download'].includes(taskData.task_type)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[DEV DEBUG] Missing url in request body for task_type', taskData.task_type, taskData);
      }
      return res.status(400).json({
        error: 'url is required for this task_type.'
      });
    }

    // Add user context to task
    const enrichedTask = {
      ...taskData,
      user_id: req.user.id,
      created_at: new Date().toISOString(),
      source: 'backend-api'
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV DEBUG] /api/automation/execute enriched payload:', JSON.stringify(enrichedTask, null, 2));
    }

    // Send task asynchronously (fire-and-forget)
    const result = await kafkaService.sendAutomationTask(enrichedTask);
    const task_id = result.taskId;

    // Store initial status in memory (for demo/dev)
    taskStatusStore.set(task_id, {
      status: 'queued',
      result: null,
      updated_at: new Date().toISOString(),
      user_id: req.user.id,
      task: enrichedTask
    });

    res.status(202).json({
      success: true,
      task_id,
      status: 'queued',
      message: 'Task accepted and queued for execution.'
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DEV DEBUG] /api/automation/execute error:', error);
    } else {
      console.error('[POST /api/automation/execute] error:', error.message);
    }
    res.status(500).json({
      error: 'Failed to queue automation task',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Legacy automation endpoint (now uses Kafka behind the scenes)
app.post('/api/trigger-automation', authMiddleware, automationLimiter, async (req, res) => {
  try {
    const taskData = req.body;
    
    // Convert legacy format to new Kafka format
    const kafkaTask = {
      task_type: taskData.action || 'web_automation',
      url: taskData.url,
      actions: taskData.steps || taskData.actions || [],
      user_id: req.user.id,
      created_at: new Date().toISOString(),
      source: 'legacy-api'
    };
    
    const result = await kafkaService.sendAutomationTask(kafkaTask);
    
    // Return legacy-compatible response
    res.status(202).json({
      success: true,
      task_id: result.taskId,
      message: 'Task queued successfully via Kafka',
      kafka_partition: result.result[0]?.partition,
      kafka_offset: result.result[0]?.offset
    });
    
  } catch (error) {
    console.error('[POST /api/trigger-automation] error:', error);
    res.status(500).json({
      error: 'Failed to trigger automation',
      details: error.message
    });
  }
});

// User Preferences Endpoints
// Get user preferences
app.get('/api/user/preferences', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[GET /api/user/preferences] error:', error);
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }

    // Convert database format to API format
    const preferences = data ? {
      notification_preferences: {
        email_notifications: data.email_notifications ?? true,
        weekly_reports: data.weekly_reports ?? true,
        sms_alerts: data.sms_notifications ?? false,
        push_notifications: data.push_notifications ?? true,
        task_completion: data.task_completion ?? true,
        task_failures: data.task_failures ?? true,
        system_alerts: data.system_alerts ?? true,
        marketing_emails: data.marketing_emails ?? true,
        security_alerts: data.security_alerts ?? true,
        deal_updates: data.deal_updates ?? true,
        customer_alerts: data.customer_alerts ?? true
      },
      ui_preferences: {
        theme: data.theme || 'light',
        dashboard_layout: data.dashboard_layout || 'grid',
        timezone: data.timezone || 'UTC',
        date_format: data.date_format || 'MM/DD/YYYY',
        language: data.language || 'en'
      },
      fcm_token: data.fcm_token || null,
      phone_number: data.phone_number || null
    } : {
      notification_preferences: {
        email_notifications: true,
        weekly_reports: true,
        sms_alerts: false,
        push_notifications: true,
        task_completion: true,
        task_failures: true,
        system_alerts: true,
        marketing_emails: true,
        security_alerts: true,
        deal_updates: true,
        customer_alerts: true
      },
      ui_preferences: {
        theme: 'light',
        dashboard_layout: 'grid',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        language: 'en'
      },
      fcm_token: null,
      phone_number: null
    };

    res.json(preferences);
  } catch (error) {
    console.error('[GET /api/user/preferences] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user preferences
app.put('/api/user/preferences', authMiddleware, async (req, res) => {
  try {
    const { notification_preferences, ui_preferences, fcm_token, phone_number } = req.body;

    // Validate input
    if (notification_preferences && typeof notification_preferences !== 'object') {
      return res.status(400).json({ error: 'notification_preferences must be an object' });
    }
    if (ui_preferences && typeof ui_preferences !== 'object') {
      return res.status(400).json({ error: 'ui_preferences must be an object' });
    }

    // Prepare update data by converting API format to database format
    const updateData = {};
    
    if (notification_preferences) {
      updateData.email_notifications = notification_preferences.email_notifications;
      updateData.weekly_reports = notification_preferences.weekly_reports;
      updateData.sms_notifications = notification_preferences.sms_alerts;
      updateData.push_notifications = notification_preferences.push_notifications;
      updateData.task_completion = notification_preferences.task_completion;
      updateData.task_failures = notification_preferences.task_failures;
      updateData.system_alerts = notification_preferences.system_alerts;
      updateData.marketing_emails = notification_preferences.marketing_emails;
      updateData.security_alerts = notification_preferences.security_alerts;
      updateData.deal_updates = notification_preferences.deal_updates;
      updateData.customer_alerts = notification_preferences.customer_alerts;
    }

    if (ui_preferences) {
      updateData.theme = ui_preferences.theme;
      updateData.dashboard_layout = ui_preferences.dashboard_layout;
      updateData.timezone = ui_preferences.timezone;
      updateData.date_format = ui_preferences.date_format;
      updateData.language = ui_preferences.language;
    }

    if (fcm_token !== undefined) updateData.fcm_token = fcm_token;
    if (phone_number !== undefined) updateData.phone_number = phone_number;

    // Update preferences in user_settings table
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: req.user.id,
        ...updateData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('[PUT /api/user/preferences] update error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ 
        error: 'Failed to update preferences',
        code: error.code,
        details: error.details || error.message
      });
    }

    console.log(`[PUT /api/user/preferences] Updated preferences for user ${req.user.id}`);
    res.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences: updateData 
    });

  } catch (error) {
    console.error('[PUT /api/user/preferences] unexpected error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user notification settings (specific endpoint for notification preferences)
app.get('/api/user/notifications', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[GET /api/user/notifications] error:', error);
      return res.status(500).json({ error: 'Failed to fetch notification settings' });
    }

    const notificationSettings = data ? {
      preferences: {
        email_notifications: data.email_notifications ?? true,
        weekly_reports: data.weekly_reports ?? true,
        sms_alerts: data.sms_notifications ?? false,
        push_notifications: data.push_notifications ?? true,
        task_completion: data.task_completion ?? true,
        task_failures: data.task_failures ?? true,
        system_alerts: data.system_alerts ?? true,
        marketing_emails: data.marketing_emails ?? true,
        security_alerts: data.security_alerts ?? true,
        deal_updates: data.deal_updates ?? true,
        customer_alerts: data.customer_alerts ?? true
      },
      fcm_token: data.fcm_token || null,
      phone_number: data.phone_number || null,
      can_receive_sms: !!data.phone_number,
      can_receive_push: !!data.fcm_token
    } : {
      preferences: {
        email_notifications: true,
        weekly_reports: true,
        sms_alerts: false,
        push_notifications: true,
        task_completion: true,
        task_failures: true,
        system_alerts: true,
        marketing_emails: true,
        security_alerts: true,
        deal_updates: true,
        customer_alerts: true
      },
      fcm_token: null,
      phone_number: null,
      can_receive_sms: false,
      can_receive_push: false
    };

    res.json(notificationSettings);
  } catch (error) {
    console.error('[GET /api/user/notifications] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification preferences
app.put('/api/user/notifications', authMiddleware, async (req, res) => {
  try {
    const { preferences, phone_number, fcm_token } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences object is required' });
    }

    // Validate phone number format if provided
    if (phone_number && !/^\+?[\d\s\-\(\)]+$/.test(phone_number)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Convert API format to database format
    const updateData = {
      email_notifications: preferences.email_notifications,
      weekly_reports: preferences.weekly_reports,
      sms_notifications: preferences.sms_alerts,
      push_notifications: preferences.push_notifications,
      task_completion: preferences.task_completion,
      task_failures: preferences.task_failures,
      system_alerts: preferences.system_alerts,
      marketing_emails: preferences.marketing_emails,
      security_alerts: preferences.security_alerts,
      deal_updates: preferences.deal_updates,
      customer_alerts: preferences.customer_alerts,
      updated_at: new Date().toISOString()
    };

    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (fcm_token !== undefined) updateData.fcm_token = fcm_token;

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: req.user.id,
        ...updateData
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('[PUT /api/user/notifications] error:', error);
      return res.status(500).json({ error: 'Failed to update notification preferences' });
    }

    console.log(`[PUT /api/user/notifications] Updated notification preferences for user ${req.user.id}`);
    res.json({ 
      success: true, 
      message: 'Notification preferences updated successfully' 
    });

  } catch (error) {
    console.error('[PUT /api/user/notifications] error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin middleware for protected endpoints
const adminAuthMiddleware = (req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'];
  const expectedSecret = process.env.ADMIN_API_SECRET;
  
  if (!expectedSecret) {
    return res.status(500).json({ error: 'ADMIN_API_SECRET not configured' });
  }
  
  if (!adminSecret || adminSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin secret' });
  }
  
  next();
};

// Firebase custom token endpoint
app.post('/api/firebase/token', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { additionalClaims } = req.body || {};

    console.log(`🔥 Generating Firebase custom token for user: ${userId}`);

    // Generate custom token using the Firebase Admin service
    const result = await firebaseNotificationService.generateCustomToken(userId, additionalClaims);

    if (!result.success) {
      console.error(`🔥 Failed to generate token for user ${userId}:`, result.error);
      return res.status(500).json({
        error: 'Failed to generate Firebase token',
        details: result.error,
        code: result.code
      });
    }

    // Get user profile for Firebase user creation if needed
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    // Optionally create Firebase user record (for advanced features)
    if (profile) {
      const userResult = await firebaseNotificationService.createFirebaseUser(userId, {
        email: profile.email,
        displayName: profile.email?.split('@')[0]
      });

      if (!userResult.success) {
        console.warn(`🔥 Failed to create Firebase user record for ${userId}:`, userResult.error);
        // Don't fail the request, token generation succeeded
      }
    }

    console.log(`🔥 Successfully generated Firebase token for user: ${userId}`);

    res.json({
      success: true,
      token: result.token,
      expiresIn: result.expiresIn,
      claims: result.claims,
      user: {
        uid: userId,
        email: profile?.email || null
      }
    });

  } catch (error) {
    console.error('[POST /api/firebase/token] error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Firebase token verification endpoint (for testing/debugging)
app.post('/api/firebase/verify-token', authMiddleware, async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: 'idToken is required'
      });
    }

    console.log(`🔥 Verifying Firebase ID token for user: ${req.user.id}`);

    const result = await firebaseNotificationService.verifyCustomToken(idToken);

    if (!result.success) {
      console.error(`🔥 Token verification failed:`, result.error);
      return res.status(401).json({
        error: 'Invalid Firebase token',
        details: result.error,
        code: result.code
      });
    }

    res.json({
      success: true,
      valid: true,
      uid: result.uid,
      supabase_uid: result.supabase_uid,
      auth_time: result.auth_time,
      provider: result.provider,
      claims: result.claims
    });

  } catch (error) {
    console.error('[POST /api/firebase/verify-token] error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Update user Firebase claims endpoint (for role management)
app.put('/api/firebase/claims', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { claims } = req.body || {};

    if (!claims || typeof claims !== 'object') {
      return res.status(400).json({
        error: 'claims object is required'
      });
    }

    // Filter out system claims that users shouldn't modify
    const systemClaims = ['supabase_uid', 'auth_time', 'provider', 'iss', 'aud', 'exp', 'iat', 'sub', 'uid'];
    const userClaims = Object.keys(claims)
      .filter(key => !systemClaims.includes(key))
      .reduce((obj, key) => {
        obj[key] = claims[key];
        return obj;
      }, {});

    console.log(`🔥 Updating Firebase claims for user ${userId}:`, userClaims);

    const result = await firebaseNotificationService.setUserClaims(userId, userClaims);

    if (!result.success) {
      console.error(`🔥 Failed to set claims for user ${userId}:`, result.error);
      return res.status(500).json({
        error: 'Failed to update Firebase claims',
        details: result.error,
        code: result.code
      });
    }

    res.json({
      success: true,
      message: 'Firebase claims updated successfully',
      claims: result.claims
    });

  } catch (error) {
    console.error('[PUT /api/firebase/claims] error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Admin endpoint for email queue statistics
app.get('/admin/email-queue-stats', adminAuthMiddleware, async (req, res) => {
  try {
    // Query email queue statistics
    const { data: stats, error } = await supabase
      .from('email_queue')
      .select('status')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        
        // Count by status
        const counts = data.reduce((acc, row) => {
          const status = row.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        
        return { data: counts, error: null };
      });

    if (error) {
      console.error('[admin/email-queue-stats] Database error:', error.message);
      return res.status(500).json({ 
        error: 'Database error', 
        message: error.message 
      });
    }

    // Ensure we have standard status counts
    const counts = {
      pending: stats.pending || 0,
      sent: stats.sent || 0,
      failed: stats.failed || 0,
      ...stats // Include any other statuses
    };

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    res.json({
      counts,
      total,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('[admin/email-queue-stats] Unexpected error:', e?.message || e);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e?.message || 'Unknown error' 
    });
  }
});

// =====================================================
// FILE MANAGEMENT API ENDPOINTS
// =====================================================

// POST /api/files/upload - Upload a new file
app.post('/api/files/upload', authMiddleware, async (req, res) => {
  console.log('[FILE UPLOAD] Starting file upload process');
  try {
    if (!req.files || !req.files.file) {
      console.log('[FILE UPLOAD] Error: No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.files.file;
    const userId = req.user.id;
    console.log(`[FILE UPLOAD] File: ${file.name}, Size: ${file.size}, User: ${userId}`);
    
    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = path.extname(file.name).toLowerCase();
    const baseName = path.basename(file.name, fileExt);
    const safeName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const filePath = `${userId}/${timestamp}_${safeName}${fileExt}`;
    
    // Upload to Supabase storage
    console.log(`[FILE UPLOAD] Uploading to Supabase storage: ${filePath}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-files')
      .upload(filePath, file.data, {
        contentType: file.mimetype,
        upsert: false
      });
      
    if (uploadError) {
      console.error('[FILE UPLOAD] Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }
    console.log(`[FILE UPLOAD] Storage upload successful: ${uploadData?.path}`);
    
    // Calculate MD5 checksum
    const checksum = crypto.createHash('md5').update(file.data).digest('hex');
    
    // Save metadata to files table
    console.log(`[FILE UPLOAD] Saving metadata to database for file: ${file.name}`);
    const fileMetadata = {
      user_id: userId,
      original_name: file.name,
      display_name: file.name,
      storage_path: filePath,
      storage_bucket: 'user-files',
      file_size: file.size,
      mime_type: file.mimetype,
      file_extension: fileExt.slice(1),
      checksum_md5: checksum,
      folder_path: req.body.folder_path || '/',
      tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',')) : [],
      metadata: req.body.category ? { category: req.body.category } : {}
    };
    console.log(`[FILE UPLOAD] Metadata object:`, JSON.stringify(fileMetadata, null, 2));
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert(fileMetadata)
      .select()
      .single();
      
    if (dbError) {
      console.error('[FILE UPLOAD] Database insert error:', dbError);
      console.error('[FILE UPLOAD] Database error details:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      });
      // Clean up uploaded file if database insert fails
      console.log(`[FILE UPLOAD] Cleaning up uploaded file: ${filePath}`);
      await supabase.storage.from('user-files').remove([filePath]);
      return res.status(500).json({ error: 'Failed to save file metadata' });
    }
    console.log(`[FILE UPLOAD] Database insert successful: ${fileRecord.id}`);

    // Track storage usage
    await usageTracker.trackStorageUsage(userId, filePath, 'added', file.size);

    console.log(`[FILE UPLOAD] Upload completed successfully for file: ${file.name}`);
    res.status(201).json({
      ...fileRecord,
      message: 'File uploaded successfully'
    });
    
  } catch (err) {
    console.error('[FILE UPLOAD] Unexpected error:', err);
    console.error('[FILE UPLOAD] Stack trace:', err.stack);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/files - Get user's files
app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { folder, limit = 50, offset = 0, search, tags, category } = req.query;
    
    let query = supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .is('expires_at', null);

    if (folder) {
      query = query.eq('folder_path', folder);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`original_name.ilike.%${search}%,display_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      if (tagArray.length > 0) {
        // Use overlaps operator to find files that have any of the specified tags
        query = query.overlaps('tags', tagArray);
      }
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
      
    if (error) {
      console.error('Files query error:', error);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }

    res.json({ files: data || [] });
    
  } catch (err) {
    console.error('[GET /api/files] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET /api/files/:id/download - Get download URL for file
app.get('/api/files/:id/download', authMiddleware, async (req, res) => {
  try {
    const { data: file, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
      
    if (error || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600);

    if (urlError) {
      console.error('Signed URL error:', urlError);
      return res.status(500).json({ error: 'Failed to generate download URL' });
    }

    await supabase
      .from('files')
      .update({ 
        download_count: (file.download_count || 0) + 1,
        last_accessed: new Date().toISOString()
      })
      .eq('id', req.params.id);

    res.json({
      download_url: signedUrl.signedUrl,
      filename: file.original_name,
      size: file.file_size,
      mime_type: file.mime_type
    });
    
  } catch (err) {
    console.error('[GET /api/files/:id/download] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// DELETE /api/files/:id - Delete file
app.delete('/api/files/:id', authMiddleware, async (req, res) => {
  try {
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
      
    if (fetchError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await supabase.storage
      .from(file.storage_bucket)
      .remove([file.storage_path]);
    
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
      
    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete file record' });
    }

    res.json({ message: 'File deleted successfully' });
    
  } catch (err) {
    console.error('[DELETE /api/files/:id] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// =====================================================
// FILE SHARING API ENDPOINTS
// =====================================================

// POST /api/files/shares - Create a new share link
app.post('/api/files/shares', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      fileId, 
      permission = 'view', 
      requirePassword = false, 
      password = null,
      expiresAt = null,
      allowAnonymous = true,
      maxDownloads = null,
      notifyOnAccess = false
    } = req.body;

    // Verify file ownership
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, original_name')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    // Hash password if provided
    let hashedPassword = null;
    if (requirePassword && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create share record (using existing schema column names)
    const shareData = {
      file_id: fileId,
      shared_by: userId, // Use existing column name
      share_token: shareToken,
      permissions: permission, // Use existing column name
      password_hash: hashedPassword,
      expires_at: expiresAt,
      max_downloads: maxDownloads,
      require_password: requirePassword,
      allow_anonymous: allowAnonymous,
      is_active: true
    };

    const { data: share, error: shareError } = await supabase
      .from('file_shares')
      .insert([shareData])
      .select()
      .single();

    if (shareError) {
      console.error('Share creation error:', shareError);
      return res.status(500).json({ error: 'Failed to create share link' });
    }

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${shareToken}`;

    res.status(201).json({
      ...share,
      shareUrl,
      password_hash: undefined // Don't return password hash
    });

  } catch (err) {
    console.error('[POST /api/files/shares] Error:', err.message);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// GET /api/files/:id/shares - Get shares for a file
app.get('/api/files/:id/shares', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const fileId = req.params.id;

    // Verify file ownership
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (fileError || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get shares (using existing schema column names)
    const { data: shares, error: sharesError } = await supabase
      .from('file_shares')
      .select('*')
      .eq('file_id', fileId)
      .eq('shared_by', userId) // Use existing column name
      .order('created_at', { ascending: false });

    if (sharesError) {
      console.error('Shares query error:', sharesError);
      return res.status(500).json({ error: 'Failed to fetch shares' });
    }

    // Add share URLs and remove password hashes
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${share.share_token}`,
      password_hash: undefined
    }));

    res.json({ shares: sharesWithUrls });

  } catch (err) {
    console.error('[GET /api/files/:id/shares] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

// PUT /api/files/shares/:shareId - Update share settings
app.put('/api/files/shares/:shareId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const shareId = req.params.shareId;
    const updates = req.body;

    // Hash new password if provided
    if (updates.password && updates.requirePassword) {
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    // Update share
    const { data: share, error: updateError } = await supabase
      .from('file_shares')
      .update({
        permissions: updates.permission, // Use existing column name
        require_password: updates.requirePassword,
        password_hash: updates.password_hash,
        expires_at: updates.expiresAt,
        allow_anonymous: updates.allowAnonymous,
        max_downloads: updates.maxDownloads,
        updated_at: new Date().toISOString()
      })
      .eq('id', shareId)
      .eq('shared_by', userId) // Use existing column name
      .select()
      .single();

    if (updateError || !share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json({
      ...share,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${share.share_token}`,
      password_hash: undefined
    });

  } catch (err) {
    console.error('[PUT /api/files/shares/:shareId] Error:', err.message);
    res.status(500).json({ error: 'Failed to update share' });
  }
});

// DELETE /api/files/shares/:shareId - Delete share
app.delete('/api/files/shares/:shareId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const shareId = req.params.shareId;

    const { error: deleteError } = await supabase
      .from('file_shares')
      .delete()
      .eq('id', shareId)
      .eq('shared_by', userId); // Use existing column name

    if (deleteError) {
      console.error('Share deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete share' });
    }

    res.json({ message: 'Share deleted successfully' });

  } catch (err) {
    console.error('[DELETE /api/files/shares/:shareId] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete share' });
  }
});

// POST /api/shared/access - Access shared file
app.post('/api/shared/access', async (req, res) => {
  try {
    const { shareToken, password } = req.body;

    if (!shareToken) {
      return res.status(400).json({ error: 'Share token required' });
    }

    // Get share details
    const { data: share, error: shareError } = await supabase
      .from('file_shares')
      .select(`
        *,
        files (
          id,
          original_name,
          file_size,
          mime_type,
          storage_bucket,
          storage_path
        )
      `)
      .eq('share_token', shareToken)
      .single();

    if (shareError || !share) {
      return res.status(404).json({ error: 'Share link not found or expired' });
    }

    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Check max downloads
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return res.status(410).json({ error: 'Maximum download limit reached' });
    }

    // Check password if required
    if (share.require_password) {
      if (!password) {
        return res.status(401).json({ error: 'Password required', requirePassword: true });
      }

      const isValidPassword = await bcrypt.compare(password, share.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Generate download URL if permission allows
    let downloadUrl = null;
    if (share.permissions === 'download' || share.permissions === 'edit') {
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from(share.files.storage_bucket)
        .createSignedUrl(share.files.storage_path, 3600);

      if (urlError) {
        console.error('Signed URL error:', urlError);
        return res.status(500).json({ error: 'Failed to generate download URL' });
      }

      downloadUrl = signedUrl.signedUrl;
    }

    // Update download count
    await supabase
      .from('file_shares')
      .update({ 
        download_count: share.download_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', share.id);

    // Send notification if enabled
    if (share.notify_on_access) {
      // TODO: Send email notification to file owner
      console.log(`File shared access: ${share.files.original_name} accessed via share link`);
    }

    res.json({
      file: {
        id: share.files.id,
        name: share.files.original_name,
        size: share.files.file_size,
        mimeType: share.files.mime_type
      },
      permission: share.permissions,
      downloadUrl,
      accessCount: share.download_count + 1
    });

  } catch (err) {
    console.error('[POST /api/shared/access] Error:', err.message);
    res.status(500).json({ error: 'Failed to access shared file' });
  }
});

// ======================================================================
// ENHANCED FEATURES - Bulk Processing & AI Integration
// ======================================================================

// Import new services (create them first if they don't exist)
let batchProcessor, integrationFramework, aiDataExtractor;

try {
  const { BatchProcessor } = require('./services/batchProcessor');
  const { IntegrationFramework } = require('./services/integrationFramework');
  const { AIDataExtractor } = require('./services/aiDataExtractor');
  
  batchProcessor = new BatchProcessor();
  integrationFramework = new IntegrationFramework();
  aiDataExtractor = new AIDataExtractor();
} catch (error) {
  console.warn('[Enhanced Features] Services not available:', error.message);
}

// POST /api/extract-data - AI-powered data extraction
app.post('/api/extract-data', authMiddleware, upload.single('file'), async (req, res) => {
  if (!aiDataExtractor) {
    return res.status(503).json({ error: 'AI extraction service not available' });
  }

  try {
    const { extractionType, targets } = req.body;
    const file = req.file;
    const userId = req.user.id;

    if (!file && !req.body.htmlContent) {
      return res.status(400).json({ error: 'File or HTML content required' });
    }

    let extractionResult;

    if (extractionType === 'invoice' && file) {
      extractionResult = await aiDataExtractor.extractInvoiceData(file.buffer, file.originalname);
    } else if (extractionType === 'webpage' && req.body.htmlContent) {
      const extractionTargets = JSON.parse(targets || '[]');
      extractionResult = await aiDataExtractor.extractWebPageData(req.body.htmlContent, extractionTargets);
    } else {
      return res.status(400).json({ error: 'Invalid extraction type or missing data' });
    }

    // Save extraction results to user_files table if file was processed
    if (extractionResult.success && file) {
      try {
        await supabase
          .from('user_files')
          .update({
            extracted_data: extractionResult.structuredData,
            ai_confidence: extractionResult.metadata?.confidence,
            processing_status: 'completed'
          })
          .eq('user_id', userId)
          .eq('file_name', file.originalname);
      } catch (dbError) {
        console.warn('[extract-data] Failed to update database:', dbError.message);
      }
    }

    res.json({
      success: true,
      extractionResult
    });

  } catch (error) {
    console.error('[extract-data] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enhanced task form - Add AI extraction to existing tasks
app.post('/api/run-task-with-ai', authMiddleware, automationLimiter, async (req, res) => {
  const { url, title, notes, type, task, username, password, pdf_url, enableAI, extractionTargets } = req.body;
  const user = req.user;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    console.log(`[run-task-with-ai] Processing AI-enhanced automation for user ${user.id}`);
    
    // Create automation task (reuse existing logic)
    const taskName = title || (type && type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || 'AI-Enhanced Task';
    const taskType = (type || task || 'general').toLowerCase();
    
    const { data: taskRecord, error: taskError } = await supabase
      .from('automation_tasks')
      .insert([{
        user_id: user.id,
        name: taskName,
        description: notes || '',
        url: url,
        task_type: taskType,
        is_active: true,
        parameters: JSON.stringify({
          username,
          password,
          pdf_url,
          enableAI: enableAI || false,
          extractionTargets: extractionTargets || []
        })
      }])
      .select()
      .single();

    if (taskError) {
      console.error('[run-task-with-ai] Error creating automation task:', taskError);
      return res.status(500).json({ error: 'Failed to create automation task' });
    }
    
    // Create automation run
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert([{
        task_id: taskRecord.id,
        user_id: user.id,
        status: 'running',
        started_at: new Date().toISOString(),
        result: JSON.stringify({ status: 'started', aiEnabled: enableAI })
      }])
      .select()
      .single();
    
    if (runError) {
      console.error('[run-task-with-ai] Error creating automation run:', runError);
      return res.status(500).json({ error: 'Failed to create automation run' });
    }

    // Enhanced processing with AI extraction
    setImmediate(async () => {
      try {
        // Run standard automation first
        const automationResult = await queueTaskRun(run.id, {
          url,
          title: taskName,
          task_id: taskRecord.id,
          user_id: user.id,
          task_type: taskType,
          parameters: { username, password, pdf_url }
        });

        // Add AI extraction if enabled and service available
        if (enableAI && aiDataExtractor && automationResult.success) {
          try {
            const extractionResult = await aiDataExtractor.extractWebPageData(
              automationResult.pageContent || automationResult.extracted_text || '',
              extractionTargets || []
            );
            
            if (extractionResult.success) {
              automationResult.extractedData = extractionResult.extractedData;
              automationResult.aiConfidence = extractionResult.metadata?.confidence;
            }
          } catch (aiError) {
            console.error('[run-task-with-ai] AI extraction failed:', aiError);
            automationResult.aiError = aiError.message;
          }
        }

        // Update run with enhanced results
        await supabase
          .from('automation_runs')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            result: JSON.stringify(automationResult),
            extracted_data: automationResult.extractedData || null
          })
          .eq('id', run.id);

        await usageTracker.trackAutomationRun(user.id, run.id, 'completed');

      } catch (error) {
        console.error('[run-task-with-ai] Enhanced automation failed:', error);
        
        await supabase
          .from('automation_runs')
          .update({
            status: 'failed',
            ended_at: new Date().toISOString(),
            result: JSON.stringify({ 
              error: 'AI-enhanced automation execution failed',
              message: error.message
            })
          })
          .eq('id', run.id);

        await usageTracker.trackAutomationRun(user.id, run.id, 'failed');
      }
    });

    res.json({
      success: true,
      message: 'AI-enhanced automation task queued successfully',
      taskId: taskRecord.id,
      runId: run.id,
      aiEnabled: enableAI
    });

  } catch (error) {
    console.error('[run-task-with-ai] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk processing endpoints
app.post('/api/bulk-process/invoices', authMiddleware, async (req, res) => {
  if (!batchProcessor) {
    return res.status(503).json({ error: 'Batch processing service not available' });
  }

  try {
    const { vendors, date_range, output_path, parallel_jobs, retry_attempts } = req.body;
    const userId = req.user.id;

    if (!vendors || vendors.length === 0) {
      return res.status(400).json({ error: 'At least one vendor configuration is required' });
    }

    // Start bulk processing
    const batchId = await batchProcessor.startBulkInvoiceProcessing({
      userId,
      vendors,
      dateRange: date_range,
      outputPath: output_path,
      parallelJobs: parallel_jobs || 3,
      retryAttempts: retry_attempts || 3
    });

    res.json({
      success: true,
      batchId,
      message: 'Bulk invoice processing started',
      estimated_time: `${vendors.length * 2} minutes`
    });

  } catch (error) {
    console.error('[bulk-process] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Extract data from multiple files
app.post('/api/extract-data-bulk', authMiddleware, async (req, res) => {
  if (!aiDataExtractor) {
    return res.status(503).json({ error: 'AI extraction service not available' });
  }

  try {
    const { fileIds, extractionType } = req.body;
    const userId = req.user.id;

    if (!fileIds || fileIds.length === 0) {
      return res.status(400).json({ error: 'File IDs are required' });
    }

    // Get file information from database
    const { data: files, error: filesError } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)
      .in('id', fileIds);

    if (filesError) {
      throw new Error(`Failed to fetch files: ${filesError.message}`);
    }

    // Start processing files in background
    const results = [];
    for (const file of files) {
      try {
        // Update status to processing
        await supabase
          .from('user_files')
          .update({ processing_status: 'processing' })
          .eq('id', file.id);

        // This would typically be done in a background job
        // For now, we'll just mark them as queued
        results.push({
          fileId: file.id,
          fileName: file.original_name,
          status: 'queued'
        });
      } catch (err) {
        results.push({
          fileId: file.id,
          fileName: file.original_name,
          status: 'error',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Started data extraction for ${results.length} file(s)`,
      results
    });

  } catch (error) {
    console.error('[extract-data-bulk] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Integration endpoints
app.get('/api/integrations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: integrations, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch integrations: ${error.message}`);
    }

    res.json({
      success: true,
      integrations: integrations || []
    });

  } catch (error) {
    console.error('[integrations] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/integrations/sync-files', authMiddleware, async (req, res) => {
  if (!integrationFramework) {
    return res.status(503).json({ error: 'Integration service not available' });
  }

  try {
    const { service, files } = req.body;
    const userId = req.user.id;

    if (!service || !files || files.length === 0) {
      return res.status(400).json({ error: 'Service name and files are required' });
    }

    // Get integration configuration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', service)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return res.status(404).json({ error: 'Integration not found or inactive' });
    }

    // Sync files using integration framework
    const syncResult = await integrationFramework.syncFiles(service, files, integration.credentials);

    res.json({
      success: true,
      syncResult,
      message: `Successfully synced ${files.length} file(s) to ${service}`
    });

  } catch (error) {
    console.error('[sync-files] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/checkout/polar - Generate Polar checkout URL with 14-day trial
app.post('/api/checkout/polar', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    const user = req.user;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.external_product_id) {
      return res.status(400).json({ error: 'Plan has no Polar product ID configured' });
    }

    // Generate Polar checkout URL with trial parameters
    const polarApiKey = process.env.POLAR_API_KEY;
    if (!polarApiKey) {
      return res.status(500).json({ error: 'Polar API not configured' });
    }

    const checkoutData = {
      product_id: plan.external_product_id,
      customer_email: user.email,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?checkout=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?checkout=cancelled`,
      trial_period_days: 14, // 14-day free trial
      metadata: {
        user_id: user.id,
        plan_id: planId,
        frontend_plan_name: plan.name
      }
    };

    const response = await axios.post('https://api.polar.sh/v1/checkouts/', checkoutData, {
      headers: {
        'Authorization': `Bearer ${polarApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const checkoutUrl = response.data.url;
    
    res.json({ 
      checkout_url: checkoutUrl,
      trial_days: 14,
      plan_name: plan.name
    });

  } catch (error) {
    console.error('Error creating Polar checkout:', error);
    if (error.response) {
      console.error('Polar API Error:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Catch-all 404 handler (must be after all routes)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Final error handler
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});


// Export for serverless and testing
module.exports = app;
// Expose internal helpers for testing
try {
  module.exports.queueTaskRun = queueTaskRun; // attach helper to exported app
} catch (e) {
  // noop
}
module.exports.sanitizeInput = sanitizeInput;
module.exports.isValidUrl = isValidUrl;
module.exports.encryptCredentials = encryptCredentials;
module.exports.decryptCredentials = decryptCredentials;
module.exports.sanitizeError = sanitizeError;
