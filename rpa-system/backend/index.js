const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const crypto = require('crypto');
const { firebaseNotificationService, NotificationTemplates } = require('./utils/firebaseAdmin');
const { getKafkaService } = require('./utils/kafkaService');
// Load environment variables from the backend/.env file (absolute, not CWD-dependent)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// Also load from root level .env file
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Debug environment variables for deployment troubleshooting
require('./debug-env');

// Import trigger system
const { TriggerService } = require('./services/triggerService');

const { createClient } = require('@supabase/supabase-js');
 const fs = require('fs');
 const morgan = require('morgan');
 const path = require('path');
const { startEmailWorker } = require('./workers/email_worker');
const { spawn } = require('child_process');
const adminTemplatesRouter = require('./routes/adminTemplates');
const { 
  requireWorkflowCreation, 
  requireAutomationRun, 
  requireFeature,
  requirePlan,
  checkStorageLimit
} = require('./middleware/planEnforcement');

const app = express();
const PORT = process.env.PORT || 3030;
// Build / deploy identifier (update automatically when patched)
const BACKEND_BUILD_ID = 'backend-index-v2-notifications-route+safe-preferences-upsert';

// Initialize trigger service
const triggerService = new TriggerService();

// Add after imports, before route definitions (around line 100)

// Authentication middleware for individual routes
const authMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const minDelay = 100; // Minimum delay in ms to prevent timing attacks
  
  try {
    // Allow public health/version endpoints without auth
    if (req.path === '/api/health' || req.path === '/api/healthz') {
      return next();
    }
    // Test bypass: allow a static bearer token to authenticate as a test user for local/dev/test
    const allowTestBypass = (process.env.ALLOW_TEST_TOKEN || '').toLowerCase() === 'true';
    const testToken = process.env.TEST_BEARER_TOKEN || '';
    const testUserId = process.env.TEST_USER_ID || '';

    const rawAuthHeader = (req.get('authorization') || '').trim();
    const authParts = rawAuthHeader.split(' ');
    const bearerToken = authParts.length === 2 && authParts[0].toLowerCase() === 'bearer' ? authParts[1] : null;

    if (allowTestBypass && bearerToken && testToken && bearerToken === testToken && testUserId) {
      req.user = { id: testUserId };
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return next();
    }
    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const authHeader = rawAuthHeader;
    const parts = authParts;
    const token = bearerToken;
    
    if (!token) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // validate token via Supabase server client
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
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
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
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
      styleSrc: ["'self'", "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='"], // Empty inline hash only
      scriptSrc: [
        "'self'",
        "https://www.googletagmanager.com",
        "https://www.uchat.com.au",
        "https://*.uchat.com.au",
        "https://sdk.dfktv2.com",
        "https://ipapi.co"
      ],
      imgSrc: ["'self'", "https:"], // Removed data: protocol
      connectSrc: [
        "'self'",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        // Allow Supabase REST/Realtime/Storage
  "https://*.supabase.co",
  "https://supabase.co",
  // Supabase Realtime (WebSocket)
  "wss://*.supabase.co",
  "wss://syxzilyuysdoirnezgii.supabase.co",
        // Third-party SDKs/services
        "https://sdk.dfktv2.com",
        "https://ipapi.co",
        "https://www.uchat.com.au",
        "https://*.uchat.com.au"
      ],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"], // Block object/embed
      mediaSrc: ["'self'"],
      frameSrc: [
        "'self'",
        "https://www.uchat.com.au",
        "https://*.uchat.com.au",
        "https://sdk.dfktv2.com"
      ], // allow uChat widget and third-party SDK frames
      childSrc: ["'none'"], // Block child contexts
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"], // Only allow forms to submit to same origin
      frameAncestors: ["'none'"], // Prevent being framed
      baseUri: ["'self'"], // Restrict base URIs
      upgradeInsecureRequests: [], // Force HTTPS
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Apply rate limiting
app.use(globalLimiter);

app.use(express.json()); // ensure body parser present

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

// Lightweight health & version endpoint (before auth requirements)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    build: BACKEND_BUILD_ID,
    time: new Date().toISOString()
  });
});
app.get('/api/healthz', (req, res) => {
  res.json({
    status: 'ok',
    build: BACKEND_BUILD_ID,
    time: new Date().toISOString()
  });
});

// Files API: list files from Supabase Storage
const { supabase: sb } = require('./supabase');
app.get('/api/files', authMiddleware, apiLimiter, async (req, res) => {
  try {
  // Prefer service-role client placed on app.locals later, else fall back to anon client
  const client = req.app && req.app.locals && req.app.locals.supaAdmin ? req.app.locals.supaAdmin : sb;
  if (!client) return res.status(503).json({ error: 'Storage not configured' });
    const userId = req.user?.id;
    // Optional: enforce plan/limits here with checkStorageLimit if required
    const folder = decodeURIComponent(req.query.folder || '/');
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const bucket = process.env.STORAGE_BUCKET || 'artifacts';

    // Supabase Storage list API
  const { data, error } = await client
      .storage
      .from(bucket)
      .list(folder === '/' ? '' : folder.replace(/^\//, ''), { limit, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (error) return res.status(500).json({ error: error.message });

    // Construct public URLs (if bucket is public) or signed URLs otherwise
    const isPublic = (process.env.STORAGE_PUBLIC || 'true').toLowerCase() === 'true';
  const files = await Promise.all((data || []).map(async (f) => {
      const path = `${folder === '/' ? '' : folder.replace(/^\//, '')}${folder.endsWith('/') || folder === '/' ? '' : '/'}${f.name}`.replace(/^\//, '');
      let url = null;
      if (isPublic) {
    const { data: pub } = client.storage.from(bucket).getPublicUrl(path);
        url = pub?.publicUrl || null;
      } else {
    const { data: signed, error: sErr } = await client.storage.from(bucket).createSignedUrl(path, 60 * 10);
        if (!sErr) url = signed?.signedUrl || null;
      }
      return { ...f, path, url };
    }));

    return res.json({ folder, bucket, files });
  } catch (e) {
    console.error('[files] list error', e?.message || e);
    return res.status(500).json({ error: 'Failed to list files' });
  }
});

// Mount admin moderation routes (protected by x-admin-secret)
try {
  const adminTemplatesRouter = require('./routes/adminTemplates');
  app.use('/admin/templates', apiLimiter, adminTemplatesRouter);
  console.log('[backend] Admin templates moderation routes mounted at /admin/templates');
} catch (e) {
  console.warn('[backend] Failed to mount /admin/templates routes:', e?.message || e);
}

// Admin routes (secured by X-Admin-Secret); mount before authMiddleware to avoid double auth
app.use('/api/admin/templates', adminTemplatesRouter);

// --- Supabase & App Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;
if (!supabase) {
  console.warn('⚠️ Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
}
// Expose admin client via app.locals for use in early-declared routes
app.locals.supaAdmin = supabase || null;
const ARTIFACTS_BUCKET = process.env.SUPABASE_BUCKET || 'artifacts';
const USE_SIGNED_URLS = (process.env.SUPABASE_USE_SIGNED_URLS || 'true').toLowerCase() !== 'false';
const SIGNED_URL_EXPIRES = Math.max(60, parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || '86400', 10));
const DOWNLOADS_DIR_CONTAINER = process.env.DOWNLOADS_DIR_CONTAINER || '/downloads';
const DOWNLOADS_DIR_HOST = process.env.DOWNLOADS_DIR_HOST || (process.cwd().includes('/workspace') ? '/workspace/downloads' : path.join(process.cwd(), 'downloads'));


// CORS: allow all in dev (when no whitelist provided); restrict in prod
// Tip: set ALLOWED_ORIGINS env as comma-separated list. We include Vercel host as a safe default allowlist entry.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://easy-flow-lac.vercel.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Debug logging for CORS configuration (quiet in production)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 CORS Debug Info:');
  console.log('   ALLOWED_ORIGINS env var:', process.env.ALLOWED_ORIGINS);
  console.log('   Parsed ALLOWED_ORIGINS:', ALLOWED_ORIGINS);
  console.log('   NODE_ENV:', process.env.NODE_ENV);
}

const corsOptions = {
  origin: (origin, cb) => {
    // Only log CORS failures, not every successful check
    if (!origin) return cb(null, true); // non-browser
    if (ALLOWED_ORIGINS.length === 0) {
      // In dev, allow all; in prod, deny by default if no explicit origins set
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      console.warn('🚫 CORS blocked: No allowed origins configured');
      return cb(new Error('CORS: origin not allowed'));
    }
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    
    // Log only when blocking unknown origins
    console.warn('🚫 CORS blocked origin:', origin);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info'],
  credentials: true,
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

// CSRF Protection (after body parsing, before routes)
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
    signed: true // Sign the cookie
  },
  // Use session secret for signing if available
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
});

// Apply CSRF protection to state-changing routes (temporarily disabled for testing)
app.use('/api', (req, res, next) => {
  // Skip CSRF for all requests temporarily
  return next();
  // Skip CSRF for GET requests and webhooks
  if (req.method === 'GET' || req.path.startsWith('/polar-webhook')) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// CSRF token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// --- API Route Setup ---

const sendEmailRoute = require('./send_email_route');
app.use('/api', sendEmailRoute);

const { router: referralRouter } = require('./referral_route');
app.use('/api', referralRouter);

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

// Import and setup workflow automation routes
const webhookRoutes = require('./routes/webhookRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const executionRoutes = require('./routes/executionRoutes');

// Mount webhook routes (no auth middleware - handles its own)
app.use('/api/webhooks', webhookRoutes);

// Mount schedule routes (protected)
app.use('/api/schedules', authMiddleware, scheduleRoutes);

// Mount execution routes (protected)
app.use('/api/executions', authMiddleware, executionRoutes);

// Execute a workflow immediately (manual trigger)
app.post('/api/workflows/execute', authMiddleware, automationLimiter, async (req, res) => {
  try {
    const { workflowId, inputData = {}, triggeredBy = 'manual' } = req.body || {};
    if (!workflowId) {
      return res.status(400).json({ error: 'workflowId is required' });
    }

    const { WorkflowExecutor } = require('./services/workflowExecutor');
    const workflowExecutor = new WorkflowExecutor();

    const execution = await workflowExecutor.startExecution({
      workflowId,
      userId: req.user.id,
      triggeredBy,
      triggerData: { inputData, source: 'api' }
    });

    return res.json({
      message: 'Workflow execution started',
      execution_id: execution.id,
      status: execution.status || 'running'
    });
  } catch (error) {
    console.error('[POST /api/workflows/execute] error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start execution' });
  }
});

// Initialize trigger service
(async () => {
  try {
    await triggerService.initialize();
    console.log('[Backend] Automation trigger system initialized');
  } catch (error) {
    console.error('[Backend] Failed to initialize trigger system:', error);
  }
})();

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
    console.log('[automation-supervisor] launching python automate.py');
    pyProc = spawn('python', ['automation/automate.py'], {
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
    // Test bypass: allow a static bearer token to authenticate as a test user for local/dev/test
    const allowTestBypass = (process.env.ALLOW_TEST_TOKEN || '').toLowerCase() === 'true';
    const testToken = process.env.TEST_BEARER_TOKEN || '';
    const testUserId = process.env.TEST_USER_ID || '';
    const rawAuthHeader = (req.get('authorization') || '').trim();
    const authParts = rawAuthHeader.split(' ');
    const bearerToken = authParts.length === 2 && authParts[0].toLowerCase() === 'bearer' ? authParts[1] : null;
    if (allowTestBypass && bearerToken && testToken && bearerToken === testToken && testUserId) {
      req.user = { id: testUserId };
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return next();
    }
    if (!supabase) {
      // Add artificial delay for consistent timing
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const authHeader = rawAuthHeader;
    const parts = authParts;
    const token = bearerToken;
    
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
    const parsedUrl = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    const blockedHosts = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1',
      '127.1', '127.0.1', '127.00.0.1', '127.000.000.001',
      '2130706433', '0x7f000001', '0177.0000.0000.0001',
      '::ffff:127.0.0.1', '::ffff:7f00:1',
      '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
      'metadata.google.internal', '169.254.169.254',
      'fd00::/8', 'fe80::/10'
    ];
    const blockedPorts = ['22', '23', '25', '53', '80', '135', '139', '443', '445', '993', '995'];
    
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return { valid: false, reason: 'Invalid protocol' };
    }
    
    // Check for blocked hostnames/IPs - use exact match or endsWith for domains
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const blocked of blockedHosts) {
      const blockedLower = blocked.toLowerCase();
      // Exact match for IPs and localhost
      if (hostname === blockedLower) {
        return { valid: false, reason: 'Blocked hostname' };
      }
      // For domains, check if hostname ends with the blocked domain (with leading dot)
      if (blockedLower.includes('.') && (hostname.endsWith('.' + blockedLower) || hostname === blockedLower)) {
        return { valid: false, reason: 'Blocked hostname' };
      }
    }
    
    // Check for private IP ranges
    if (isPrivateIP(hostname)) {
      return { valid: false, reason: 'Private IP address blocked' };
    }
    
    if (blockedPorts.includes(parsedUrl.port)) {
      return { valid: false, reason: 'Blocked port' };
    }
    
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'Invalid URL format' };
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
    
    // Get the automation worker URL from environment or use safe default
  const automationUrl = process.env.AUTOMATION_URL || 'internal:embedded';
    
    // Prepare the payload for the automation worker
    const payload = { 
      url: taskData.url,
      title: taskData.title || 'Untitled Task',
      run_id: runId,
      task_id: taskData.task_id,
      user_id: taskData.user_id
    };
    
    console.log(`[queueTaskRun] Sending to automation service: ${automationUrl}`);
    
    // Call the real automation service
    try {
      let automationResult;
      let response = null;
      
      if (automationUrl === 'internal:embedded') {
        // Placeholder synchronous stub; replace with real python invocation via child_process if needed
        automationResult = { message: 'Embedded automation stub executed', url: taskData.url };
        console.log(`[queueTaskRun] Using embedded automation mode - task simulated successfully`);
      } else {
        const fullAutomationUrl = automationUrl + '/automate';
        response = await axios.post(fullAutomationUrl, payload, { 
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.AUTOMATION_API_KEY}`
          }
        });
        automationResult = response.data || { message: 'Execution completed with no data returned' };
        console.log(`[queueTaskRun] Automation service response:`, 
          response.status, response.data ? 'data received' : 'no data');
      }
      
      // Process files from real automation service
      if (automationResult && automationResult.files_created && automationResult.files_created.length > 0) {
        const fileRecords = automationResult.files_created.map(file => ({
          user_id: taskData.user_id,
          filename: file.filename,
          file_path: file.path,
          file_size: file.size,
          file_type: file.type,
          automation_run_id: runId,
          created_at: new Date().toISOString()
        }));

        const { error: filesError } = await supabase
          .from('files')
          .insert(fileRecords);

        if (filesError) {
          console.error('Error creating file records:', filesError);
        } else {
          console.log(`📁 Created ${fileRecords.length} file records from real automation`);
        }
      }

      // Update the run with the result
      await supabase
        .from('automation_runs')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          result: automationResult
        })
        .eq('id', runId);

      // Send notification for task completion
      try {
        const taskName = taskData.title || 'Automation Task';
        const notification = NotificationTemplates.taskCompleted(taskName);
        await firebaseNotificationService.sendAndStoreNotification(taskData.user_id, notification);
        console.log(`🔔 Task completion notification sent to user ${taskData.user_id}`);
      } catch (notificationError) {
        console.error('🔔 Failed to send task completion notification:', notificationError.message);
      }
        
      return response.data || automationResult;
    } catch (error) {
      console.error(`[queueTaskRun] Automation service error:`, error.message);
      
      // Update the run with the error
      await supabase
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
  if (typeof input !== 'string') return input;
  
  return input
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
    // Remove iframe, object, embed tags
    .replace(/<(iframe|object|embed|form|meta|link)[^>]*>/gi, '')
    // Remove closing tags for dangerous elements
    .replace(/<\/(iframe|object|embed|form|meta|link)>/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Limit length
    .substring(0, 1000);
}

// Credential encryption
function encryptCredentials(credentials, key) {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(32); // Generate random salt
  const keyBuffer = crypto.scryptSync(key, salt, 32); // Use random salt
  const cipher = crypto.createCipherGCM(algorithm, keyBuffer, iv);
  
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
  const decipher = crypto.createDecipherGCM(
    encryptedData.algorithm || 'aes-256-gcm', 
    keyBuffer, 
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// POST /api/run-task - Secured automation endpoint with plan enforcement
app.post('/api/run-task', authMiddleware, requireAutomationRun, automationLimiter, async (req, res) => {
  const { url, title, notes, type, task, username, password, pdf_url } = req.body;
  const user = req.user;

  // Basic validation: url required and must be valid
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  try {
    // Validate URL format
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Ensure Supabase admin client is available
  if (!supabase) {
    const resp = { error: 'Server misconfiguration: database client unavailable' };
    if (process.env.NODE_ENV !== 'production') {
      resp.debug = {
        hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in the backend environment',
        env_present: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
        }
      };
    }
    return res.status(500).json(resp);
  }

  try {
    console.log(`[run-task] Processing automation for user ${user.id}`);
    
    // First, create or find a task in automation_tasks
    const taskName = title || (type && type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || (task && task.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || 'Automation Task';
    const taskType = type || task || 'general';
    
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
      const resp = { error: 'Failed to create automation task' };
      if (process.env.NODE_ENV !== 'production') {
        resp.debug = {
          code: taskError.code,
          message: taskError.message,
          details: taskError.details,
          hint: taskError.hint
        };
      }
      return res.status(500).json(resp);
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
      const resp = { error: 'Failed to create automation run' };
      if (process.env.NODE_ENV !== 'production') {
        resp.debug = {
          code: runError.code,
          message: runError.message,
          details: runError.details,
          hint: runError.hint
        };
      }
      return res.status(500).json(resp);
    }
    
    // Queue the task processing - update this to use automation_runs instead of task_runs
    await queueTaskRun(run.id, { 
      url, 
      title: taskName, 
      task_id: taskRecord.id,
      user_id: user.id 
    });
    
    return res.status(200).json({ 
      id: run.id,
      status: 'queued',
      message: 'Task queued for processing'
    });
    
  } catch (error) {
    console.error('[run-task] Unhandled error:', error.message || error);
    const resp = { error: process.env.NODE_ENV !== 'production' ? (error.message || 'Failed to process request') : 'Failed to process request' };
    if (process.env.NODE_ENV !== 'production') {
      resp.debug = {
        name: error.name,
        stack: (error.stack || '').split('\n').slice(0, 3).join('\n')
      };
    }
    return res.status(500).json(resp);
  }
});

// POST /api/notifications/create - server-side notification creation & optional push
// NOTE: This route existed in app.js but not in the active entrypoint (index.js), causing 404s from the frontend fallback.
app.post('/api/notifications/create', authMiddleware, async (req, res) => {
  try {
    const { type, title, body, priority = 'normal', data = {} } = req.body || {};
    if (!type || !title || !body) {
      return res.status(400).json({ error: 'type, title and body are required' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication failed: user missing on request' });
    }

    const notification = { type, title, body, priority, data };

    if (!firebaseNotificationService || !firebaseNotificationService.isConfigured) {
      console.warn('[POST /api/notifications/create] Firebase not fully configured; attempting store only');
    }

    try {
      const result = await firebaseNotificationService.sendAndStoreNotification(req.user.id, notification);

      if (!result.store.success) {
        return res.status(500).json({
          error: 'Failed to store notification',
          store_error: result.store.error,
          push_error: result.push?.error || null
        });
      }

      return res.json({
        success: true,
        notification_id: result.store.notificationId,
        push: result.push,
        stored: result.store
      });
    } catch (innerErr) {
      console.error('[POST /api/notifications/create] send/store failure:', innerErr);
      return res.status(500).json({ error: 'Failed to process notification', details: innerErr.message });
    }
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

// POST /api/tasks - Create a new automation task with plan enforcement
app.post('/api/tasks', authMiddleware, requireWorkflowCreation, async (req, res) => {
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
    const automationUrl = process.env.AUTOMATION_URL || 'internal:embedded';
    const payload = { 
      url: task.url, 
      username: task.parameters?.username, 
      password: task.parameters?.password,
      pdf_url: task.parameters?.pdf_url
    };
    
    const fullAutomationUrl = automationUrl + '/automate';
    const response = await axios.post(fullAutomationUrl, payload, { timeout: 120000 });
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

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (err) {
    console.error(`[DELETE /api/tasks/${req.params.id}] Error:`, err.message);
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
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
    // Ensure a profile exists for this user to satisfy FK constraints
    if (req.user?.id) {
      try {
        await ensureUserProfile(req.user.id, req.user.email || null);
      } catch (e) {
        console.warn('[enqueue-email] ensureUserProfile failed', e?.message || e);
      }
    }
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

// --- Test helpers (enabled only when ALLOW_TEST_TOKEN=true) ---
if ((process.env.ALLOW_TEST_TOKEN || '').toLowerCase() === 'true') {
  app.post('/api/test/bootstrap', async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: 'server misconfigured' });
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'auth required' });

      // Ensure profile exists
      await ensureUserProfile(userId, req.user?.email || 'bootstrap@test.local');

      // Create a workflow with start->delay->end
      const { data: wf, error: wfErr } = await supabase
        .from('workflows')
        .insert({ name: 'Bootstrap WF', status: 'active', user_id: userId })
        .select('*')
        .single();
      if (wfErr) throw wfErr;
      const workflowId = wf.id;

      const steps = [
        { id: `start-${workflowId}`, workflow_id: workflowId, step_type: 'start', name: 'Start', step_key: 'start', action_type: null, config: {} },
        { id: `delay-${workflowId}`, workflow_id: workflowId, step_type: 'action', name: 'Delay', step_key: 'delay', action_type: 'delay', config: { duration_seconds: 3, duration_type: 'fixed' } },
        { id: `end-${workflowId}`, workflow_id: workflowId, step_type: 'end', name: 'End', step_key: 'end', action_type: null, config: {} },
      ];
      const { error: stepsErr } = await supabase.from('workflow_steps').insert(steps);
      if (stepsErr) throw stepsErr;
      const conns = [
        { workflow_id: workflowId, source_step_id: steps[0].id, target_step_id: steps[1].id },
        { workflow_id: workflowId, source_step_id: steps[1].id, target_step_id: steps[2].id },
      ];
      const { error: connErr } = await supabase.from('workflow_connections').insert(conns);
      if (connErr) throw connErr;

      // Create execution row directly in running status
      const { data: exec, error: execErr } = await supabase
        .from('workflow_executions')
        .insert({ workflow_id: workflowId, user_id: userId, status: 'running', started_at: new Date().toISOString(), steps_total: 3 })
        .select('*')
        .single();
      if (execErr) throw execErr;

      // Create a running step row
      await supabase
        .from('step_executions')
        .insert({ workflow_execution_id: exec.id, step_id: steps[1].id, status: 'running', started_at: new Date().toISOString(), execution_order: 2 });

      return res.json({ workflow_id: workflowId, execution_id: exec.id, step_ids: steps.map(s => s.id) });
    } catch (e) {
      console.error('[test/bootstrap] error', e?.message || e);
      return res.status(500).json({ error: 'bootstrap failed', details: e?.message || String(e) });
    }
  });
}

async function ensureUserProfile(userId, email) {
  try {
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (!existingProfile) {
      if (process.env.NODE_ENV === 'development') console.log(`[ensureUserProfile] Creating missing profile for user ${userId}, email: ${email}`);
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
      if (process.env.NODE_ENV === 'development') console.log(`[ensureUserProfile] Successfully created profile for user ${userId}`);
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
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] No user found on request');
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }
    const { campaign, to_email } = req.body || {};
    if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Received request: campaign=${campaign}, to_email=${to_email}, user_id=${req.user.id}`);
    if (!campaign) {
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] No campaign specified');
      return res.status(400).json({ error: 'campaign is required' });
    }

    // Enhanced email lookup with multiple strategies
    let targetEmail = to_email || null;
    if (!targetEmail) {
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Looking up user email - trying multiple sources...');
      
      // Strategy 1: Try profiles table (existing logic)
      try {
        if (supabase) {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', req.user.id)
            .maybeSingle();
          if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Profile lookup result:', { profile, pErr });
          if (pErr && process.env.NODE_ENV === 'development') console.warn('[trigger-campaign] profile lookup error', pErr.message || pErr);
          if (profile && profile.email) {
            targetEmail = profile.email;
            if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Found target email from profile: ${targetEmail}`);
          } else {
            if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] No email found in profiles table');
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.warn('[trigger-campaign] profile lookup failed', e?.message || e);
      }
    }
    
    // Strategy 2: Try auth.users table if still no email
    if (!targetEmail && supabase) {
      try {
        if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Trying auth.users table...');
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(req.user.id);
        
        if (authUser && authUser.user && authUser.user.email) {
          targetEmail = authUser.user.email;
          if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Found email in auth.users:', targetEmail);
        } else {
          if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] No email in auth.users');
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Auth.users lookup failed:', e.message);
      }
    }
    
    // Strategy 3: Try req.user.email directly
    if (!targetEmail && req.user.email) {
      targetEmail = req.user.email;
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Using email from req.user:', targetEmail);
    }
    
    // Strategy 4: Try user_metadata
    if (!targetEmail && req.user.user_metadata && req.user.user_metadata.email) {
      targetEmail = req.user.user_metadata.email;
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Using email from user_metadata:', targetEmail);
    }

    // Strategy 5: Debug user object to see available data
    if (!targetEmail) {
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Available user data:', JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        user_metadata: req.user.user_metadata,
        app_metadata: req.user.app_metadata,
        aud: req.user.aud,
        role: req.user.role
      }, null, 2));
    }

    if (!targetEmail) {
      if (process.env.NODE_ENV === 'development') console.log('[trigger-campaign] Target email not found after all strategies');
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

    if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Final target email: ${targetEmail}`);

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
        if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Enqueuing welcome and followup emails for ${targetEmail}`, inserts);
        break;
      default:
        // Handle other campaigns if you add them
        if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Unknown campaign: ${campaign}`);
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
      if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] Successfully enqueued ${inserts.length} emails for campaign ${campaign}`);
      
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
          if (process.env.NODE_ENV === 'development') console.log(`🔔 Welcome notification sent to user ${req.user.id}`);
        } catch (notificationError) {
          console.error('🔔 Failed to send welcome notification:', notificationError.message);
        }
      }
    } else if (!supabase) {
      if (process.env.NODE_ENV === 'development') console.warn('[trigger-campaign] No Supabase client available - emails not enqueued');
    } else {
      if (process.env.NODE_ENV === 'development') console.log(`[trigger-campaign] No emails enqueued for campaign ${campaign}`);
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

// Execute automation task via Kafka (with result callback)
app.post('/api/automation/execute', authMiddleware, automationLimiter, async (req, res) => {
  try {
    const taskData = req.body;
    const timeout = parseInt(req.query.timeout) || 60000; // Default 60 second timeout
    
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
    
    console.log(`[POST /api/automation/execute] Executing task for user ${req.user.id}:`, enrichedTask);
    
    // Send task and wait for result
    const result = await kafkaService.sendAutomationTaskWithCallback(enrichedTask, timeout);
    
    console.log(`[POST /api/automation/execute] Task completed:`, result);
    
    res.json({
      success: true,
      task_id: result.task_id,
      status: result.status,
      result: result.result,
      worker_id: result.worker_id,
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('[POST /api/automation/execute] error:', error);
    
    if (error.message.includes('timed out')) {
      res.status(408).json({
        error: 'Task execution timeout',
        details: error.message,
        suggestion: 'Try increasing the timeout parameter or use /api/automation/queue for long-running tasks'
      });
    } else {
      res.status(500).json({
        error: 'Failed to execute automation task',
        details: error.message
      });
    }
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

    // Safe upsert sequence to avoid duplicate key errors when unique(user_id) conflicts occur
    // 1. Check if row exists
    const { data: existing, error: selectError } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', req.user.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[PUT /api/user/preferences] select error:', selectError);
      return res.status(500).json({ error: 'Failed to read existing preferences', code: selectError.code });
    }

    let mutationError = null;
    if (existing) {
      // 2a. Update existing row
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.user.id);
      mutationError = updateError || null;
      if (!mutationError) {
        console.log(`[PUT /api/user/preferences] Updated existing preferences row for user ${req.user.id}`);
      }
    } else {
      // 2b. Insert new row
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert([{ 
          user_id: req.user.id,
          ...updateData,
          updated_at: new Date().toISOString()
        }]);
      mutationError = insertError || null;
      if (!mutationError) {
        console.log(`[PUT /api/user/preferences] Inserted new preferences row for user ${req.user.id}`);
      }
    }

    if (mutationError) {
      console.error('[PUT /api/user/preferences] mutation error:', {
        code: mutationError.code,
        message: mutationError.message,
        details: mutationError.details,
        hint: mutationError.hint
      });
      // Provide targeted guidance for duplicate key / RLS cases
      let guidance = undefined;
      if (mutationError.code === '23505') {
        guidance = 'Unique constraint hit; row exists but update likely blocked by RLS. Ensure an UPDATE policy exists on user_settings for user_id = auth.uid().';
      }
      return res.status(500).json({ 
        error: 'Failed to persist preferences',
        code: mutationError.code,
        details: mutationError.details || mutationError.message,
        guidance
      });
    }

    console.log(`[PUT /api/user/preferences] Updated preferences for user ${req.user.id}`);
    res.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences: updateData 
    });

  } catch (error) {
    console.error('[PUT /api/user/preferences] error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Final error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Export the app for testing
module.exports = app;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n[Backend] Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop trigger service
    await triggerService.shutdown();
    
    console.log('[Backend] Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('[Backend] Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server only if this file is run directly (not imported)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}
