
const { logger, getLogger } = require('./utils/logger');
// --- Initialize OpenTelemetry first for comprehensive instrumentation ---
// ✅ OBSERVABILITY: Always enable telemetry - use sampling to control volume, not disable
// Sampling is configured in telemetryInit.js (default 10% via OTEL_TRACE_SAMPLING_RATIO)
if (process.env.DISABLE_TELEMETRY === 'true') {
  logger.warn('⚠️ [Observability] Telemetry disabled via DISABLE_TELEMETRY=true');
  logger.warn('⚠️ [Observability] Consider using OTEL_TRACE_SAMPLING_RATIO=0.1 (10%) instead of disabling');
  logger.warn('⚠️ [Observability] Disabling telemetry removes visibility into application behavior');
} else {
  try {
    require('./middleware/telemetryInit');
    logger.info('✅ [Observability] OpenTelemetry initialized - all logs integrated with traces');
  } catch (e) {
    logger.error('❌ [Observability] telemetryInit failed to load:', e?.message || e);
    logger.error('   Application will continue but observability will be limited');
  }
}

// --- Initialize structured logging after telemetry ---
const { createLogger } = require('./middleware/structuredLogging');
const rootLogger = createLogger('app.startup');

// --- Enhanced global error handlers with structured logging ---
process.on('uncaughtException', (err) => {
  rootLogger.fatal('Uncaught Exception - Application will exit', err, {
    process: { pid: process.pid, uptime: process.uptime() }
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  rootLogger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
    promise_details: promise.toString(),
    process: { pid: process.pid, uptime: process.uptime() }
  });
});
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
const { v4: uuidv4 } = require('uuid');
// Load environment variables from the backend/.env file early so modules that
// require configuration (Firebase, Supabase, etc.) see the variables on require-time.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { firebaseNotificationService, NotificationTemplates } = require('./utils/firebaseAdmin');
const { getKafkaService } = require('./utils/kafkaService');
const taskStatusStore = require('./utils/taskStatusStore');
const { usageTracker } = require('./utils/usageTracker');
const { auditLogger } = require('./utils/auditLogger');
const { LinkDiscoveryService } = require('./services/linkDiscoveryService');
const { requireAutomationRun, requireWorkflowRun, requireWorkflowCreation, checkStorageLimit, requireFeature, requirePlan } = require('./middleware/planEnforcement');
const { traceContextMiddleware, createContextLogger } = require('./middleware/traceContext');
// Backwards-compatible alias: some modules use `contextLoggerMiddleware` name
const contextLoggerMiddleware = traceContextMiddleware;
const { requestLoggingMiddleware } = require('./middleware/structuredLogging');
 const { createClient } = require('@supabase/supabase-js');
 const fs = require('fs');
 const morgan = require('morgan');
 const path = require('path');
const { startEmailWorker } = require('./workers/email_worker');
const { spawn } = require('child_process');

// Import route modules - make some optional for local dev
let polarRoutes = null;
let socialProofRoutes = null;

try {
  polarRoutes = require('./routes/polarRoutes');
  rootLogger.info('✓ Polar routes loaded');
} catch (e) {
  logger.warn('⚠️ Polar routes disabled:', e.message);
}

try {
  socialProofRoutes = require('./routes/socialProofRoutes');
  rootLogger.info('✓ Social proof routes loaded');
} catch (e) {
  logger.warn('⚠️ Social proof routes disabled:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3030;

// Trust proxy for Render deployment (fixes rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy only (more secure than true)
}

// ✅ CORS MUST BE FIRST - Apply immediately after app creation
// CORS: sensible defaults in dev; restrict in prod via ALLOWED_ORIGINS
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3030',
  'http://127.0.0.1:3030',
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
  rootLogger.info('🔧 CORS Debug Info (app.js):', {
    ALLOWED_ORIGINS_env: process.env.ALLOWED_ORIGINS,
    parsed_allowed_origins: ALLOWED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
  });
}

const corsOptions = {
  origin: (origin, cb) => {
    // ✅ FIX: Allow webhook endpoints without origin (Polar sends webhooks without Origin header)
    // For non-browser requests (no Origin header), allow them (needed for webhooks)
    if (!origin) {
      // Allow requests without origin (webhooks, server-to-server)
      // Return a permissive origin for webhook compatibility
      return cb(null, '*');
    }

    // Exact allow-list - return the origin string (not true) when credentials are enabled
    if (ALLOWED_ORIGINS.includes(origin)) {
      // Return the origin string explicitly to avoid wildcard issues with credentials
      return cb(null, origin);
    }

    // Suffix-based allow (e.g., preview deployments like *.vercel.app)
    if (ALLOWED_SUFFIXES.some(suf => origin.endsWith(suf))) {
      return cb(null, origin);
    }

    // As a last resort in dev, be permissive when not explicitly configured
    // But still return the origin string, not true, to work with credentials
    if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') {
      return cb(null, origin);
    }

    rootLogger.warn('🚫 CORS blocked origin (app.js):', origin);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-request-id', 'x-trace-id', 'traceparent', 'apikey'],
  credentials: true, // CRITICAL: Must be true to allow cookies/credentials
  optionsSuccessStatus: 204,
  exposedHeaders: ['Content-Disposition'],
};

// Apply CORS FIRST - before any other middleware
app.use(cors(corsOptions));
// Ensure preflight requests are handled consistently
app.options('*', cors(corsOptions));

// Add after imports, before route definitions (around line 100)

// --- PUBLIC HEALTH ENDPOINTS (must be above auth middleware) ---
const authMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const minDelay = 100; // Minimum delay in ms to prevent timing attacks

  try {
    // Test bypass for Jest tests
    if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_TOKEN === 'true') {
      const authHeader = (req.get('authorization') || '').trim();
      if (authHeader === 'Bearer test-token') {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        return next();
      }
    }

    const authHeader = (req.get('authorization') || '').trim();
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;

    // Development bypass token - allows testing without Supabase
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_TOKEN && token === process.env.DEV_BYPASS_TOKEN) {
      req.user = {
        id: process.env.DEV_USER_ID || 'dev-user-123',
        email: 'developer@localhost',
        user_metadata: { name: 'Local Developer' }
      };
      req.devBypass = true; // Flag for feature enforcement to skip checks
      return next();
    }

    if (!supabase) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (!token) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // validate token via Supabase server client
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      rootLogger.warn('Auth middleware: Invalid token', { error: error?.message, path: req.path });
      await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // attach user to request for downstream handlers
    req.user = data.user;

    // Ensure minimum delay even for successful auth
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minDelay - (Date.now() - startTime))));
    return next();

  } catch (err) {
    rootLogger.error(err, 'Authentication middleware error', {
      path: req.path,
      method: req.method
    });
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
  keyGenerator: (req /*, res */) => {
    try {
      if (req.ip) return req.ip;
      const xff = req.headers['x-forwarded-for'];
      if (xff && typeof xff === 'string') return xff.split(',')[0].trim();
      return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  },
  skip: (req) => {
    // Skip rate limiting if dev bypass is active
    return req.devBypass === true;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Much higher limit for development
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  keyGenerator: (req) => {
    try { return req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown'; } catch (e) { return 'unknown'; }
  },
  skip: (req) => {
    // Skip rate limiting if dev bypass is active OR in development mode
    return req.devBypass === true || process.env.NODE_ENV === 'development';
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
  },
  keyGenerator: (req) => {
    try { return req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown'; } catch (e) { return 'unknown'; }
  },
  skip: (req) => {
    // Skip rate limiting if dev bypass is active
    return req.devBypass === true;
  }
});

// Strict limiter for automation endpoints
const automationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Increased for development
  message: {
    error: 'Automation rate limit exceeded, please try again later.'
  },
  keyGenerator: (req) => {
    try { return req.ip || (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown'; } catch (e) { return 'unknown'; }
  },
  skip: (req) => {
    // Skip rate limiting if dev bypass is active
    return req.devBypass === true;
  }
});

// Security headers
// Build CSP directives dynamically to include configured Supabase and OTLP origins.
(() => {
  const directives = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", 'https:'],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://www.uchat.com.au',
      'https://*.uchat.com.au',
      'https://uchat.com.au',
      'https://sdk.dfktv2.com',
      'https://*.dfktv2.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://js.hs-scripts.com',
      'https://js-na1.hs-scripts.com',
      'https://js-na2.hs-scripts.com',
      'https://*.hubspot.com',
      'https://js.hs-analytics.net',
      'https://*.hs-analytics.net',
      'https://js-na2.hs-banner.com',
      'https://*.hscollectedforms.net',
      // Firebase and Google Identity Toolkit
      'https://www.gstatic.com',
      'https://*.gstatic.com',
      'https://www.googleapis.com',
      'https://*.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firebase.googleapis.com',
      'https://*.firebase.googleapis.com',
      'https://*.firebaseapp.com',
      'https://*.firebaseio.com'
    ],
    imgSrc: ["'self'", 'https:'],
    connectSrc: ["'self'", 'https://sdk.dfktv2.com', 'https://*.dfktv2.com', 'https://www.uchat.com.au', 'https://*.uchat.com.au', 'https://www.google-analytics.com', 'https://analytics.google.com', 'https://*.googleapis.com', 'https://ipapi.co', 'https://*.hubspot.com', 'https://*.hs-analytics.net', 'https://*.hscollectedforms.net', 'https://api.hubapi.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firebase.googleapis.com', 'https://*.firebase.googleapis.com', 'https://*.firebaseapp.com', 'https://*.firebaseio.com', 'https://fcmregistrations.googleapis.com'],
    fontSrc: ["'self'", 'https:'],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    childSrc: ["'none'"],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: []
  };

  // Allow Supabase origins if configured (handles exact origin from SUPABASE_URL)
  try {
    if (process.env.SUPABASE_URL) {
      const supUrl = new URL(process.env.SUPABASE_URL);
      const origin = supUrl.origin;
      if (!directives.connectSrc.includes(origin)) directives.connectSrc.push(origin);
      // allow image and websocket forms commonly used by Supabase
      if (!directives.imgSrc.includes(origin)) directives.imgSrc.push(origin);
      const wsProto = origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
      if (!directives.connectSrc.includes(wsProto)) directives.connectSrc.push(wsProto);
    }
  } catch (e) {
    // ignore bad SUPABASE_URL
  }

  // Allow generic supabase wildcard hosts as well
  ['https://*.supabase.co', 'https://*.supabase.in', 'wss://*.supabase.co', 'wss://*.supabase.in'].forEach(u => {
    if (!directives.connectSrc.includes(u)) directives.connectSrc.push(u);
    if (u.startsWith('https://') && !directives.imgSrc.includes(u.replace(/\*\./, ''))) {
      // leave imgSrc alone for wildcard handling
    }
  });

  // Allow local OTLP collector in development
  if (process.env.NODE_ENV !== 'production') {
    if (!directives.connectSrc.includes('http://localhost:4318')) directives.connectSrc.push('http://localhost:4318');
    // Allow localhost scripts and connections for development
    if (!directives.scriptSrc.includes('http://localhost:3000')) directives.scriptSrc.push('http://localhost:3000');
    if (!directives.scriptSrc.includes('http://localhost:3030')) directives.scriptSrc.push('http://localhost:3030');
    if (!directives.scriptSrc.includes('http://127.0.0.1:3000')) directives.scriptSrc.push('http://127.0.0.1:3000');
    if (!directives.scriptSrc.includes('http://127.0.0.1:3030')) directives.scriptSrc.push('http://127.0.0.1:3030');
    if (!directives.connectSrc.includes('http://localhost:3000')) directives.connectSrc.push('http://localhost:3000');
    if (!directives.connectSrc.includes('http://localhost:3030')) directives.connectSrc.push('http://localhost:3030');
    if (!directives.connectSrc.includes('http://127.0.0.1:3000')) directives.connectSrc.push('http://127.0.0.1:3000');
    if (!directives.connectSrc.includes('http://127.0.0.1:3030')) directives.connectSrc.push('http://127.0.0.1:3030');
  }

  // Add OTLP exporter origin if provided
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      const otlp = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
      if (!directives.connectSrc.includes(otlp.origin)) directives.connectSrc.push(otlp.origin);
    } catch (e) {
      // ignore invalid OTLP endpoint
    }
  }

  // Ensure Supabase image origins are allowed
  if (!directives.imgSrc.includes('https://*.supabase.co')) directives.imgSrc.push('https://*.supabase.co');
  if (!directives.imgSrc.includes('https://*.supabase.in')) directives.imgSrc.push('https://*.supabase.in');

  app.use(helmet({
    contentSecurityPolicy: { directives },
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
    },
    // CRITICAL: Disable Helmet's CORS handling - we handle it explicitly with cors() middleware
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }));
})();

// Add cookie-parser with secret for signed cookies (required for CSRF)
const SESSION_SECRET = process.env.SESSION_SECRET;
let sessionSecretToUse;

if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    rootLogger.fatal('SESSION_SECRET is required in production. Set the SESSION_SECRET environment variable and restart.');
    process.exit(1);
  } else {
    // Generate a secure ephemeral secret for development/test to avoid hardcoded values.
    sessionSecretToUse = crypto.randomBytes(32).toString('hex');
    rootLogger.warn('SESSION_SECRET not provided; using an ephemeral secret for non-production environment (will change on restart).');
  }
} else {
  sessionSecretToUse = SESSION_SECRET;
}

app.use(cookieParser(sessionSecretToUse));


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
  logger.warn('[boot] devBypass middleware not mounted:', err?.message || err);
}

// Set secure session cookie defaults
app.use((req, res, next) => {
  // Set secure cookie defaults for all cookies
  const originalCookie = res.cookie;
  res.cookie = function(name, value, options = {}) {
    const secureOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // In production when frontend and backend are cross-site we need SameSite=None
      // In development keep SameSite lax so cookies work on localhost without HTTPS
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: options.maxAge || 3600000, // 1 hour default
      ...options
    };
    return originalCookie.call(this, name, value, secureOptions);
  };
  next();
});

// --- Supabase & App Config ---
const { getSupabase, getSupabaseOrThrow, isSupabaseConfigured } = require('./utils/supabaseClient');
let supabase = null;
try {
  supabase = getSupabase();
if (!supabase) {
  logger.warn('⚠️ Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
    logger.warn('⚠️ Database operations (automation history, task tracking) will fail without Supabase configuration.');
} else {
  // Initialize usage tracker with supabase client
  usageTracker.initialize(supabase);
  logger.info('✅ Usage tracker initialized');
    logger.info('✅ Supabase client ready for database operations');
  }
} catch (err) {
  logger.error('❌ Failed to initialize Supabase client:', err.message || err);
  supabase = null;
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


// CORS configuration moved to top of file (after app creation) for proper middleware order

// ✅ CRITICAL: Add trace context middleware EARLY in chain
// This must come after CORS but before auth/business logic
app.use(traceContextMiddleware);

// ✅ Add structured request logging middleware
// This should come immediately after trace context to capture all requests
app.use(requestLoggingMiddleware());

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
  logger.warn('⚠️ express-fileupload not installed; file upload endpoints will respond with 501 in dev');
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
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', // Allow cross-site for production
    maxAge: 3600000,
    signed: true
  },
  secret: process.env.SESSION_SECRET || (() => {
    logger.warn('⚠️ SESSION_SECRET not set in environment. Using default (INSECURE for production).');
    return 'test-session-secret-32-characters-long';
  })()
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
// CSRF token endpoint (development only)
app.get('/api/csrf-token', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.json({ csrfToken: null, message: 'CSRF disabled in production' });
  }
  
  csrfProtection(req, res, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to generate CSRF token' });
    res.json({ csrfToken: req.csrfToken() });
  });
});

// GET /api/plans - Fetch all available subscription plans
app.get('/api/plans', async (_req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });
    const { data, error } = await supabase.from('plans').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error('[GET /api/plans] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plans', details: err.message });
  }
});

// Fetch recent logs - requires audit logs feature  
app.get('/api/logs', authMiddleware, requireFeature('audit_logs'), async (req, res) => {
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

// CSRF Protection - DISABLED in development for stability
if (process.env.NODE_ENV === 'test') {
  app.post('/api/tasks', csrfProtection, (req, res, next) => next());
} else if (process.env.NODE_ENV === 'development') {
  // DISABLED in development - CSRF causes too many errors with SPA
  logger.info('🔓 CSRF disabled in development');
} else if (process.env.NODE_ENV !== 'production') {
  // Staging/other: enable with exceptions
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || 
        req.url.includes('/polar-webhook') || 
        req.url.includes('/checkout/') ||
        req.url.includes('/workflows/execute') ||
        req.url.includes('/automation/execute') ||
        req.url.includes('/executions/') ||
        req.url.includes('/run-task') ||
        req.url.includes('/track-event') ||
        req.url.includes('/analytics') ||
        req.url.includes('/firebase/')) {
      return next();
    }
    return csrfProtection(req, res, next);
  });
} else {
  // Production: CSRF disabled, rely on auth middleware + CORS
  logger.info('🔓 CSRF disabled in production (cross-domain deployment)');
}

// Mount webhook routes (before other middleware to handle raw body parsing)
if (polarRoutes) {
  app.use('/api/polar-webhook', polarRoutes);
}

// Mount social proof routes (public endpoint, no auth required)
if (socialProofRoutes) {
  app.use('/api', socialProofRoutes);
}

// Mount feedback routes (public endpoint, no auth required for submissions)
const feedbackRoutes = require('./routes/feedbackRoutes');
app.use('/api', feedbackRoutes);

// Internal (dev) routes - accept frontend telemetry and error reports
try {
  const internalRoutes = require('./routes/internalRoutes');
  app.use('/internal', internalRoutes);
  rootLogger.info('✓ Internal routes mounted at /internal');
} catch (e) {
  rootLogger.warn('internalRoutes not mounted', { error: e?.message || e });
}

// Demo page for social proof testing
app.get('/demo/social-proof', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'social-proof.html'));
});

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
            logger.info('[dev seeder] creating dev user via supabase.admin.createUser', { email });
            const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
            if (createErr || !newUser) {
              logger.error('[dev seeder] failed to create dev user via admin API:', createErr);
            } else {
              userIdToUse = newUser.id || (newUser.user && newUser.user.id) || null;
            }
          }

          // Fallback: call Supabase Admin REST API directly (works when service role key is available)
          if (!userIdToUse) {
            try {
              const adminUrl = `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1/admin/users`;
              logger.info('[dev seeder] attempting Supabase Admin REST API createUser', { adminUrl, email });
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
              logger.info('[dev seeder] admin REST create user resp:', { status: resp.status, id: userIdToUse });
            } catch (e) {
              logger.error('[dev seeder] admin REST createUser failed:', e?.message || e);
            }
          }

          if (!userIdToUse) {
            return res.status(400).json({
              error: 'no-valid-user',
              message: 'No existing Supabase user found and automatic creation failed. Create a user in Supabase or set DEV_USER_ID in backend .env to a valid auth user id.'
            });
          }
        } catch (e) {
          logger.error('[dev seeder] admin createUser failed:', e?.message || e);
          return res.status(500).json({ error: 'create-user-failed', detail: e?.message || String(e) });
        }
    }

    const { data: wf, error: wfError } = await supabase
      .from('workflows')
      .insert([{ name: 'Dev Sample Workflow', description: 'Seeded for local development', status, canvas_config, user_id: userIdToUse }])
      .select()
      .maybeSingle();

    if (wfError || !wf) {
      logger.error('[dev seeder] failed to create workflow:', wfError);
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
      logger.error('[dev seeder] failed to insert steps:', stepError);
      return res.status(500).json({ error: 'create-steps-failed', detail: stepError?.message || String(stepError) });
    }

    return res.json({ ok: true, workflow: wf, steps: stepData });
  } catch (e) {
    logger.error('[dev seeder] unexpected error:', e?.message || e);
    return res.status(500).json({ error: 'unexpected', detail: e?.message || String(e) });
  }
});

// --- API Route Setup ---

const sendEmailRoute = require('./send_email_route');
app.use('/api', sendEmailRoute);

const { router: referralRouter } = require('./referral_route');
app.use('/api', referralRouter);

// Polar webhook routes (already imported above and mounted at /api/polar-webhook)

// Execution routes: details, steps, cancel
try {
  const executionRoutes = require('./routes/executionRoutes');
  // ✅ INSTRUCTION 1: Apply context logger middleware after auth
  app.use('/api/executions', authMiddleware, contextLoggerMiddleware, apiLimiter, executionRoutes);
  rootLogger.info('✓ Execution routes mounted at /api/executions');
} catch (e) {
  rootLogger.warn('executionRoutes not mounted', { error: e?.message || e });
}

// ✅ PHASE 3: Workflow recovery routes
try {
  const recoveryRoutes = require('./routes/workflowRecoveryRoutes');
  app.use('/api/workflows', authMiddleware, contextLoggerMiddleware, apiLimiter, recoveryRoutes);
  rootLogger.info('✓ Workflow recovery routes mounted at /api/workflows');
} catch (e) {
  rootLogger.warn('workflowRecoveryRoutes not mounted', { error: e?.message || e });
}

// Audit logs routes
try {
  const auditLogsRoutes = require('./routes/auditLogs');
  app.use('/api/audit-logs', authMiddleware, contextLoggerMiddleware, apiLimiter, auditLogsRoutes);
} catch (e) {
  rootLogger.warn('auditLogsRoutes not mounted', { error: e?.message || e });
}

// ROI analytics routes
try {
  const roiAnalyticsRoutes = require('./routes/roiAnalytics');
  app.use('/api/roi-analytics', authMiddleware, contextLoggerMiddleware, apiLimiter, roiAnalyticsRoutes);
} catch (e) {
  rootLogger.warn('roiAnalyticsRoutes not mounted', { error: e?.message || e });
}

// Data retention routes
try {
  const dataRetentionRoutes = require('./routes/dataRetention');
  app.use('/api/data-retention', authMiddleware, contextLoggerMiddleware, apiLimiter, dataRetentionRoutes);
} catch (e) {
  rootLogger.warn('dataRetentionRoutes not mounted', { error: e?.message || e });
}

// Workflow versioning routes
try {
  const workflowVersioningRoutes = require('./routes/workflowVersioning');
  app.use('/api/workflows', authMiddleware, contextLoggerMiddleware, apiLimiter, workflowVersioningRoutes);
} catch (e) {
  rootLogger.warn('workflowVersioningRoutes not mounted', { error: e?.message || e });
}

// AccessibleOS Task Management routes (merged from AccessibleOS)
try {
  const accessibleOSTasksRoutes = require('./routes/accessibleOSTasks');
  app.use('/api/accessibleos/tasks', authMiddleware, contextLoggerMiddleware, apiLimiter, accessibleOSTasksRoutes);
  rootLogger.info('✓ AccessibleOS tasks routes mounted at /api/accessibleos/tasks');
} catch (e) {
  rootLogger.warn('accessibleOSTasksRoutes not mounted', { error: e?.message || e });
}

// Start a workflow execution
try {
  const { WorkflowExecutor } = require('./services/workflowExecutor');
  app.post('/api/workflows/execute', authMiddleware, requireWorkflowRun, apiLimiter, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const { workflowId, inputData = {}, triggeredBy = 'manual', triggerData = {} } = req.body || {};
      if (!workflowId) return res.status(400).json({ error: 'workflowId is required' });

      const executor = new WorkflowExecutor();
      logger.info('[API] execute request', { userId, workflowId, triggeredBy });
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
          logger.warn('[API] workflow not found:', { workflowId, userId, message: msg });
          return res.status(404).json({ error: msg });
        }
        if (msg.includes('Workflow is not active')) {
          logger.warn('[API] workflow not active:', { workflowId, userId, message: msg });
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
      logger.error('[API] /api/workflows/execute error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to start execution' });
    }
  });

  // ✅ SPRINT: One-click retry endpoint for failed workflows
  app.post('/api/workflows/:executionId/retry', authMiddleware, requireWorkflowRun, apiLimiter, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      const { executionId } = req.params;
      
      const executor = new WorkflowExecutor();
      
      // Get the original execution
      const { data: originalExecution, error: fetchError } = await executor.supabase
        .from('workflow_executions')
        .select('*, workflows(*)')
        .eq('id', executionId)
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !originalExecution) {
        return res.status(404).json({ error: 'Execution not found' });
      }
      
      if (originalExecution.status !== 'failed') {
        return res.status(400).json({ error: 'Can only retry failed executions' });
      }
      
      // Start new execution with same input data
      const newExecution = await executor.startExecution({
        workflowId: originalExecution.workflow_id,
        userId,
        triggeredBy: 'retry',
        triggerData: {
          retry_of: executionId,
          original_error: originalExecution.error_message
        },
        inputData: originalExecution.input_data || {}
      });
      
      logger.info('[API] Retry execution created', {
        original_execution_id: executionId,
        new_execution_id: newExecution.id,
        userId
      });
      
      return res.json({ 
        execution: newExecution,
        retry_of: executionId,
        message: 'Workflow retry started successfully'
      });
    } catch (err) {
      logger.error('[API] /api/workflows/:executionId/retry error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to retry execution' });
    }
  });
} catch (e) {
  logger.warn('[boot] workflows execute route not mounted:', e?.message || e);
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
        logger.error('[dev execute] unexpected error', err);
        return res.status(500).json({ error: 'failed', detail: msg });
      }
    });
    logger.info('[dev execute] /api/dev/workflows/execute available in dev');
  } catch (e) {
    logger.warn('[dev execute] could not mount dev execute route:', e?.message || e);
  }
}

// Use morgan for HTTP request logging (sampled to reduce volume)
// Only log 1 in N requests based on REQUEST_LOG_SAMPLE_RATE
// Default: 1% (1 in 100) - reduced from previous to minimize log noise
const REQUEST_LOG_SAMPLE_RATE = parseInt(process.env.REQUEST_LOG_SAMPLE_RATE || '100', 10);
let requestCounter = 0;

if (process.env.NODE_ENV === 'development') {
  // In development, sample requests to avoid log flooding
  app.use((req, res, next) => {
    requestCounter++;
    if (requestCounter % REQUEST_LOG_SAMPLE_RATE === 0) {
      morgan('dev')(req, res, () => {});
    }
    next();
  });
} else {
  // In production, use combined format (less verbose)
  app.use(morgan('combined'));
}

// Serve static files from React build (if it exists)
const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
if (fs.existsSync(reactBuildPath)) {
  app.use('/app', express.static(reactBuildPath));
  app.use('/app/*', (_req, res) => {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
}

// Serve demo pages and assets
const demoRoutes = require('./routes/demoRoutes');
app.use(demoRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', time: new Date().toISOString() });
});

// Enhanced health check endpoint for database services
// ✅ DIAGNOSTIC: Add Supabase connectivity check endpoint
app.get('/api/health/supabase', async (_req, res) => {
  try {
    const { isSupabaseConfigured, getSupabase } = require('./utils/supabaseClient');
    const configured = isSupabaseConfigured();
    const client = getSupabase();
    
    if (!configured) {
      return res.status(503).json({
        status: 'not_configured',
        message: 'Supabase environment variables not set',
        required: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE or SUPABASE_SERVICE_ROLE_KEY'],
        has_url: !!process.env.SUPABASE_URL,
        has_key: !!(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
      });
    }
    
    if (!client) {
      return res.status(503).json({
        status: 'initialization_failed',
        message: 'Supabase client failed to initialize',
        configured: true
      });
    }
    
    // Test database connectivity with a simple query
    const { data, error } = await client
      .from('automation_tasks')
      .select('id')
      .limit(1);
    
    if (error) {
      return res.status(503).json({
        status: 'connection_failed',
        message: 'Cannot connect to Supabase database',
        error: error.message,
        code: error.code,
        hint: error.hint
      });
    }
    
    return res.json({
      status: 'healthy',
      message: 'Supabase connection successful',
      can_read: true,
      tables_accessible: ['automation_tasks']
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: err.message
    });
  }
});

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
  
  // ✅ FIX: Start periodic cleanup of stuck executions
  const { WorkflowExecutor } = require('./services/workflowExecutor');
  const CLEANUP_INTERVAL_MS = (process.env.STUCK_EXECUTION_CLEANUP_INTERVAL_MINUTES || 10) * 60 * 1000;
  const MAX_AGE_MINUTES = process.env.STUCK_EXECUTION_MAX_AGE_MINUTES || 10;
  
  // Run cleanup immediately on startup (after 30 seconds to let server stabilize)
  setTimeout(async () => {
    try {
      const result = await WorkflowExecutor.cleanupStuckExecutions(MAX_AGE_MINUTES);
      if (result.cleaned > 0) {
        rootLogger.info(`✅ Cleaned up ${result.cleaned} stuck execution(s) on startup`);
      }
      if (result.errors.length > 0) {
        rootLogger.warn(`⚠️ Encountered ${result.errors.length} error(s) during cleanup`);
      }
    } catch (error) {
      rootLogger.error('Failed to run initial stuck execution cleanup:', error);
    }
  }, 30000);
  
  // Schedule periodic cleanup
  setInterval(async () => {
    try {
      const result = await WorkflowExecutor.cleanupStuckExecutions(MAX_AGE_MINUTES);
      if (result.cleaned > 0) {
        rootLogger.info(`✅ Cleaned up ${result.cleaned} stuck execution(s)`);
      }
    } catch (error) {
      rootLogger.error('Failed to run periodic stuck execution cleanup:', error);
    }
  }, CLEANUP_INTERVAL_MS);
  
  rootLogger.info(`✅ Stuck execution cleanup scheduled (every ${CLEANUP_INTERVAL_MS / 60000} minutes, max age: ${MAX_AGE_MINUTES} minutes)`);
}

// Optional embedded Python automation supervisor (disabled in production by default)
if ((process.env.AUTOMATION_MODE || 'stub') === 'python' && process.env.NODE_ENV !== 'production') {
  let pyProc;
  const startPython = () => {
    if (pyProc) return;
    logger.info('[automation-supervisor] launching python automation-service/production_automation_service.py');
    pyProc = spawn('python', ['automation/automation-service/production_automation_service.py'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '7070' }
    });
    pyProc.stdout.on('data', d => process.stdout.write('[automation] ' + d));
    pyProc.stderr.on('data', d => process.stderr.write('[automation:err] ' + d));
    pyProc.on('exit', code => {
      logger.warn('[automation-supervisor] python exited code', code);
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

// Backend authentication endpoints for when Supabase isn't available
app.get('/api/auth/session', async (req, res) => {
  // ✅ OBSERVABILITY: Use structured logger that integrates with OpenTelemetry traces
  const authLogger = createLogger('auth.session');
  
  try {
    // Diagnostic: prefer Authorization header but also accept cookies (signed or unsigned)
    const headerToken = req.headers.authorization?.replace('Bearer ', '') || null;

    // Look for common cookie names that might contain an access token
    // - signed cookies are available on req.signedCookies when cookieParser(secret) is used
    // - unsigned cookies are on req.cookies
    const cookieCandidates = [];
    try {
      // Signed cookies (if any)
      if (req.signedCookies) {
        Object.keys(req.signedCookies).forEach(k => cookieCandidates.push({ name: k, value: req.signedCookies[k], signed: true }));
      }
    } catch (e) { /* ignore */ }
    try {
      if (req.cookies) {
        Object.keys(req.cookies).forEach(k => cookieCandidates.push({ name: k, value: req.cookies[k], signed: false }));
      }
    } catch (e) { /* ignore */ }

    // Common keys used by apps/clients — check these first for convenience
    const preferKeys = ['dev_token', 'authToken', 'token', 'access_token', 'sb_access_token', 'supabase-auth-token', 'supabase-token', 'sb:token'];

    // Helper: return first candidate that looks like a JWT (has two dots), matches preferred names,
    // or contains a JSON/session payload that can be parsed to extract an access_token.
    const selectTokenFromCookies = () => {
      // prefer by exact key
      for (const k of preferKeys) {
        const found = cookieCandidates.find(c => c.name === k && c.value);
        if (found && typeof found.value === 'string' && found.value.length > 0) return found.value;
      }

      const tryExtract = (val) => {
        if (!val || typeof val !== 'string') return null;
        // If it's a JWT-looking string, return it
        if (val.split('.').length === 3) return val;
        // If it looks like URL-encoded JSON, try decode
        try {
          const decoded = decodeURIComponent(val);
          if (decoded && decoded.trim().startsWith('{')) {
            const parsed = JSON.parse(decoded);
            if (parsed && parsed.access_token) return parsed.access_token;
            // some Supabase clients store session under 'currentSession'
            if (parsed.currentSession && parsed.currentSession.access_token) return parsed.currentSession.access_token;
            if (parsed.session && parsed.session.access_token) return parsed.session.access_token;
          }
        } catch (e) { /* ignore */ }

        // If it's raw JSON
        try {
          if (val.trim().startsWith('{')) {
            const parsed = JSON.parse(val);
            if (parsed && parsed.access_token) return parsed.access_token;
            if (parsed.currentSession && parsed.currentSession.access_token) return parsed.currentSession.access_token;
            if (parsed.session && parsed.session.access_token) return parsed.session.access_token;
          }
        } catch (e) { /* ignore */ }

        // If the cookie contains a substring like access_token=..., extract it
        const m = String(val).match(/access_token=([^;,&]+)/);
        if (m && m[1]) return m[1];

        return null;
      };

      // First, prefer any cookie that looks like a JWT
      for (const c of cookieCandidates) {
        const extracted = tryExtract(c.value);
        if (extracted) return extracted;
      }

      // Otherwise pick first non-empty string value as a last resort
      for (const c of cookieCandidates) {
        if (typeof c.value === 'string' && c.value.length > 0) return c.value;
      }
      return null;
    };

    const cookieToken = selectTokenFromCookies();

    // Diagnostic logging to assist local debugging (quiet in production)
    if (process.env.NODE_ENV !== 'production') {
      try {
        logger.info('[auth/session] headerToken:', !!headerToken, 'cookieToken:', !!cookieToken, 'cookieKeys:', Object.keys(req.cookies || {}).join(','));
      } catch (e) {}
    }

    // Development bypass via header or environment DEV_BYPASS_TOKEN
    const devToken = headerToken || cookieToken;
    if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_TOKEN && devToken === process.env.DEV_BYPASS_TOKEN) {
      return res.json({
        user: {
          id: process.env.DEV_USER_ID || 'dev-user-123',
          email: 'developer@localhost',
          user_metadata: { name: 'Local Developer' }
        },
        access_token: devToken,
        expires_at: Date.now() + 3600000
      });
    }

    // Try to get session from Supabase if available using token from header or cookie
    const tokenToVerify = headerToken || cookieToken;
    if (supabase && tokenToVerify) {
      try {
        // ✅ FIX: Validate token format before calling Supabase to avoid verbose error logging
        // Check if token looks like a valid JWT (has 3 parts separated by dots)
        const tokenParts = tokenToVerify.split('.');
        if (tokenParts.length !== 3) {
          // Malformed token - clear it and return 401
          // ✅ OBSERVABILITY: Use structured logger with sampling (warn level sampled at 10%)
          authLogger.warn('Malformed JWT token format', {
            token_parts: tokenParts.length,
            has_token: !!tokenToVerify
          });
          return res.status(401).json({ error: 'Invalid token format' });
        }
        
        // Check for invalid characters that would cause parsing errors
        if (/[\x00-\x1F\x7F]/.test(tokenToVerify)) {
          // Token contains control characters - likely corrupted
          // ✅ OBSERVABILITY: Log with structured logger (sampled automatically)
          authLogger.warn('JWT token contains invalid control characters', {
            token_length: tokenToVerify.length,
            has_control_chars: true
          });
          return res.status(401).json({ error: 'Invalid token format' });
        }
        
        const { data: { user }, error } = await supabase.auth.getUser(tokenToVerify);
        if (!error && user) {
          return res.json({ user, access_token: tokenToVerify, expires_at: Date.now() + 3600000 });
        }
        if (error) {
          // ✅ OBSERVABILITY: Use structured logger - automatically integrates with traces and sampling
          // Warn level is sampled at 10% by default (configurable via WARN_LOG_SAMPLE_RATE)
          const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          authLogger.warn('Supabase getUser returned error', {
            error_code: error?.code,
            error_message: errorMessage,
            error_type: error?.name || 'AuthError'
          });
        }
      } catch (error) {
        // ✅ OBSERVABILITY: Structured error logging with full context
        authLogger.error('Supabase session check failed', error, {
          error_type: error?.constructor?.name || 'UnknownError',
          has_token: !!tokenToVerify
        });
      }
    }

    // No valid session
    res.status(401).json({ error: 'No valid session' });
  } catch (error) {
    // ✅ OBSERVABILITY: Use structured logger for errors (always logged, not sampled)
    authLogger.error('Session check error', error, {
      error_type: error?.constructor?.name || 'UnknownError'
    });
    // Always return JSON, never HTML
    res.status(500).json({ 
      error: 'Session check failed',
      message: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const startTime = Date.now();
  const email = req.body?.email;
  const requestId = req.headers['x-request-id'] || auditLogger.generateRequestId();
  
  // Log login attempt with observability
  logger.info('🔐 [Auth] Login attempt', {
    email: email ? email.substring(0, 3) + '***' : 'missing',
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    user_agent: req.get('User-Agent') || 'unknown',
    request_id: requestId,
    timestamp: new Date().toISOString()
  });

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      logger.warn('🔐 [Auth] Login failed: missing credentials', {
        email: email ? email.substring(0, 3) + '***' : 'missing',
        has_password: !!password,
        request_id: requestId
      });
      await auditLogger.logAuthEvent(null, 'login_attempt', false, {
        reason: 'missing_credentials',
        email: email || 'missing'
      }, req);
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Try Supabase login if available
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (!error && data.user) {
          const duration = Date.now() - startTime;
          logger.info('✅ [Auth] Login successful', {
            user_id: data.user.id,
            email: email.substring(0, 3) + '***',
            duration_ms: duration,
            request_id: requestId
          });
          await auditLogger.logAuthEvent(data.user.id, 'login', true, {
            method: 'supabase',
            duration_ms: duration
          }, req);
          return res.json({
            user: data.user,
            session: data.session
          });
        }
        
        if (error) {
          const duration = Date.now() - startTime;
          logger.warn('❌ [Auth] Login failed: Supabase error', {
            email: email.substring(0, 3) + '***',
            error: error.message,
            error_code: error.status || 'unknown',
            duration_ms: duration,
            request_id: requestId
          });
          await auditLogger.logAuthEvent(null, 'login_attempt', false, {
            reason: 'supabase_error',
            error: error.message,
            error_code: error.status || 'unknown',
            email: email.substring(0, 3) + '***'
          }, req);
          return res.status(401).json({ error: error.message });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('❌ [Auth] Supabase login exception', {
          email: email.substring(0, 3) + '***',
          error: error.message,
          stack: error.stack,
          duration_ms: duration,
          request_id: requestId
        });
        await auditLogger.logAuthEvent(null, 'login_attempt', false, {
          reason: 'supabase_exception',
          error: error.message,
          email: email.substring(0, 3) + '***'
        }, req);
      }
    } else {
      logger.warn('⚠️ [Auth] Supabase client not initialized', {
        email: email.substring(0, 3) + '***',
        request_id: requestId
      });
    }

    // Development fallback - accept any login in dev mode
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - startTime;
      const devUser = {
        id: process.env.DEV_USER_ID || 'dev-user-123',
        email: email,
        user_metadata: { name: 'Developer User' }
      };
      
      logger.info('🔧 [Auth] Dev mode login (bypass)', {
        email: email.substring(0, 3) + '***',
        user_id: devUser.id,
        duration_ms: duration,
        request_id: requestId
      });
      await auditLogger.logAuthEvent(devUser.id, 'login', true, {
        method: 'dev_bypass',
        duration_ms: duration
      }, req);
      
      // Use a configured dev bypass token when available; otherwise generate a secure ephemeral token.
      // Note: Generated tokens are ephemeral and intended for local development only.
      const devAccessToken = process.env.DEV_BYPASS_TOKEN || crypto.randomBytes(24).toString('hex');
      
      return res.json({
        user: devUser,
        session: {
          user: devUser,
          access_token: devAccessToken,
          expires_at: Date.now() + 3600000
        }
      });
    }

    const duration = Date.now() - startTime;
    logger.error('❌ [Auth] Authentication not configured', {
      email: email.substring(0, 3) + '***',
      has_supabase: !!supabase,
      node_env: process.env.NODE_ENV,
      duration_ms: duration,
      request_id: requestId
    });
    await auditLogger.logAuthEvent(null, 'login_attempt', false, {
      reason: 'auth_not_configured',
      has_supabase: !!supabase,
      node_env: process.env.NODE_ENV,
      email: email.substring(0, 3) + '***'
    }, req);
    res.status(401).json({ error: 'Authentication not configured' });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('❌ [Auth] Login exception', {
      email: email ? email.substring(0, 3) + '***' : 'missing',
      error: error.message,
      stack: error.stack,
      duration_ms: duration,
      request_id: requestId
    });
    await auditLogger.logAuthEvent(null, 'login_attempt', false, {
      reason: 'exception',
      error: error.message,
      email: email ? email.substring(0, 3) + '***' : 'missing'
    }, req).catch(() => {}); // Don't fail if audit logging fails
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    // Try Supabase logout if available
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        logger.warn('Supabase logout failed:', error.message);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
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
    logger.error('[GET /api/plans] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plans', details: err.message });
  }
});

// Moved to authenticated section

// Fetch recent logs - requires audit logs feature  
app.get('/api/logs', authMiddleware, requireFeature('audit_logs'), async (req, res) => {
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
    logger.error('[auth middleware] error', err?.message || err);
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
    if (isPrivateIP(parsed.hostname)) return { valid: false, reason: 'private-ip' };
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
    logger.info(`[queueTaskRun] Queueing automation run ${runId}`);
    
    // Get the automation worker URL from environment
    const automationUrl = process.env.AUTOMATION_URL;
    if (!automationUrl) {
      const errorMessage = 'Automation service is not configured. Please contact support to enable this feature.';
      logger.error(`[queueTaskRun] ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    // ✅ PRIORITY 1: Health check before execution with retry scheduling + OBSERVABILITY
    const healthCheckStartTime = Date.now();
    let healthCheckPassed = false;
    try {
      let normalizedUrl = automationUrl.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      
      // ✅ OBSERVABILITY: Log health check attempt
      logger.info(`[queueTaskRun] 🔍 Health check: ${normalizedUrl}`, {
        run_id: runId,
        automation_url: normalizedUrl,
        timestamp: new Date().toISOString()
      });
      
      // Quick health check
      const axios = require('axios');
      await axios.get(`${normalizedUrl}/health`, { timeout: 5000 }).catch(() => {
        // Try root endpoint if /health doesn't exist
        return axios.get(normalizedUrl, { timeout: 5000, validateStatus: () => true });
      });
      
      const healthCheckDuration = Date.now() - healthCheckStartTime;
      healthCheckPassed = true;
      
      // ✅ OBSERVABILITY: Log successful health check
      logger.info(`[queueTaskRun] ✅ Health check passed`, {
        run_id: runId,
        automation_url: normalizedUrl,
        duration_ms: healthCheckDuration,
        timestamp: new Date().toISOString()
      });
    } catch (healthError) {
      const healthCheckDuration = Date.now() - healthCheckStartTime;
      
      // ✅ PRIORITY 1: Schedule retry in 5 minutes instead of failing immediately
      // ✅ OBSERVABILITY: Log health check failure with full context
      logger.warn(`[queueTaskRun] ⚠️ Automation service health check failed, scheduling retry in 5 minutes`, {
        run_id: runId,
        error: healthError.message,
        error_code: healthError.code,
        automation_url: automationUrl,
        duration_ms: healthCheckDuration,
        retry_scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
        observability: {
          event: 'health_check_failed',
          retry_scheduled: true,
          retry_delay_seconds: 300
        }
      });
      
      // Update run status to show retry scheduled
      try {
        await supabase
          .from('automation_runs')
          .update({
            status: 'running', // Keep as running to show it's pending retry
            result: JSON.stringify({
              status: 'queued',
              message: 'Service unavailable, retrying in 5 min',
              retry_scheduled: true,
              retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              health_check_error: healthError.message
            })
          })
          .eq('id', runId);
      } catch (updateErr) {
        logger.error(`[queueTaskRun] Failed to update run status for retry:`, updateErr.message);
      }
      
      // Schedule retry in 5 minutes
      setTimeout(async () => {
        logger.info(`[queueTaskRun] 🔄 Retrying automation run ${runId} after health check failure`);
        try {
          await queueTaskRun(runId, taskData);
        } catch (retryError) {
          logger.error(`[queueTaskRun] Retry failed for run ${runId}:`, retryError.message);
          // Mark as failed if retry also fails
          try {
            await supabase
              .from('automation_runs')
              .update({
                status: 'failed',
                ended_at: new Date().toISOString(),
                result: JSON.stringify({
                  error: 'Automation service unavailable after retry',
                  message: 'Service was unavailable and retry also failed. Please try again later.',
                  retry_attempted: true
                })
              })
              .eq('id', runId);
          } catch (finalErr) {
            logger.error(`[queueTaskRun] Failed to mark run as failed after retry:`, finalErr.message);
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      // Don't throw - let the retry happen in background
      return { 
        success: false, 
        retry_scheduled: true,
        message: 'Service unavailable, retrying in 5 min',
        retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };
    }
    
    // ✅ SECURITY: Validate URL to prevent SSRF
    if (taskData.url) {
      const urlValidation = isValidUrl(taskData.url);
      if (!urlValidation.valid) {
        logger.warn(`[queueTaskRun] Invalid URL rejected: ${taskData.url} (reason: ${urlValidation.reason})`);
        throw new Error(`Invalid URL: ${urlValidation.reason === 'private-ip' ? 'Private IP addresses are not allowed' : 'Invalid URL format'}`);
      }
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
    
    logger.info(`[queueTaskRun] Sending to automation service: ${automationUrl}`);
    
    // ✅ PRIORITY 2: Call automation service with retry logic (3x: 0s, 5s, 15s)
    try {
      let automationResult;
      let response = null;
      const maxRetries = 3;
      const backoffDelays = [0, 5000, 15000]; // 0s, 5s, 15s
      let lastError;
      
      // Ensure URL has protocol; accept values like 'localhost:5001' and normalize to 'http://localhost:5001'
      let normalizedUrl = automationUrl;
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      normalizedUrl = normalizedUrl.trim();
      
      // Try type-specific endpoints first, then fall back to generic /automate
      const taskTypeSlug = String(payload.type || 'general').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
      const candidates = [
        `/automate/${encodeURIComponent(taskTypeSlug)}`,
        `/${encodeURIComponent(taskTypeSlug)}`,
        '/automate'
      ];

      // ✅ OBSERVABILITY: Track retry attempts with timing
      const automationStartTime = Date.now();
      
      // Retry loop with exponential backoff
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        lastError = null;
        const attemptStartTime = Date.now();
        
        // ✅ OBSERVABILITY: Log each retry attempt with full context
        logger.info(`[queueTaskRun] 🔄 Automation attempt ${attempt}/${maxRetries}`, {
          run_id: runId,
          attempt,
          max_attempts: maxRetries,
          wait_ms: attempt > 1 ? backoffDelays[attempt - 1] : 0,
          backoff_delays: backoffDelays,
          timestamp: new Date().toISOString(),
          observability: {
            event: 'automation_retry_attempt',
            attempt_number: attempt,
            total_attempts: maxRetries
          }
        });
        
        // Wait before retry (except first attempt)
        if (attempt > 1) {
          const waitMs = backoffDelays[attempt - 1];
          logger.info(`[queueTaskRun] ⏳ Waiting ${waitMs}ms before retry`, { 
            run_id: runId,
            wait_ms,
            attempt,
            observability: {
              event: 'retry_backoff_wait',
              wait_ms
            }
          });
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        
        // Try each endpoint candidate
        for (const pathSuffix of candidates) {
          const base = normalizedUrl.replace(/\/$/, '');
          const fullAutomationUrl = `${base}${pathSuffix}`;
          
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
            const attemptDuration = Date.now() - attemptStartTime;
            const totalDuration = Date.now() - automationStartTime;
            
            // ✅ OBSERVABILITY: Log successful automation with timing metrics
            logger.info(`[queueTaskRun] ✅ Automation succeeded on attempt ${attempt}`, {
              run_id: runId,
              endpoint: pathSuffix,
              status: response.status,
              attempt,
              attempt_duration_ms: attemptDuration,
              total_duration_ms: totalDuration,
              timestamp: new Date().toISOString(),
              observability: {
                event: 'automation_success',
                attempt_number: attempt,
                duration_ms: attemptDuration,
                total_duration_ms: totalDuration
              }
            });
            break; // Success - exit both loops
          } catch (err) {
            lastError = err;
            const isRetryable = 
              err.code === 'ECONNRESET' || 
              err.code === 'ETIMEDOUT' || 
              err.code === 'ENOTFOUND' ||
              err.code === 'EAI_AGAIN' ||
              (err.response?.status >= 500) ||
              (err.response?.status === 408) ||
              (err.response?.status === 429) ||
              err.message?.toLowerCase().includes('timeout') ||
              err.message?.toLowerCase().includes('network');
            
            logger.warn(`[queueTaskRun] ⚠️ Endpoint ${pathSuffix} failed (attempt ${attempt})`, {
              run_id: runId,
              status: err?.response?.status,
              error: err.message,
              is_retryable: isRetryable,
              attempt
            });
            
            // If not retryable, don't try other endpoints
            if (!isRetryable) {
              break;
            }
          }
        }
        
        // If we got a result, exit retry loop
        if (automationResult) {
          break;
        }
        
        // If last attempt and still no result, throw
        if (attempt === maxRetries && lastError) {
          const totalDuration = Date.now() - automationStartTime;
          logger.error(`[queueTaskRun] ❌ All ${maxRetries} attempts failed`, {
            run_id: runId,
            final_error: lastError.message,
            final_error_code: lastError.code,
            attempts: maxRetries,
            total_duration_ms: totalDuration,
            backoff_delays_used: backoffDelays,
            timestamp: new Date().toISOString(),
            observability: {
              event: 'automation_all_retries_failed',
              total_attempts: maxRetries,
              total_duration_ms: totalDuration,
              final_error: lastError.message,
              final_error_code: lastError.code
            }
          });
          throw lastError;
        }
      }
      
      if (!automationResult) {
        throw new Error('Automation service returned no result after all retries');
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
        logger.info(`🔔 Task completion notification sent to user ${taskData.user_id}`);
      } catch (notificationError) {
        logger.error('🔔 Failed to send task completion notification:', notificationError.message);
      }
        
  return response?.data ?? automationResult;
    } catch (error) {
      logger.error(`[queueTaskRun] Automation service error:`, error.message);
      
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
        logger.info(`🔔 Task failure notification sent to user ${taskData.user_id}`);
      } catch (notificationError) {
        logger.error('🔔 Failed to send task failure notification:', notificationError.message);
      }
        
      throw error;
    }
  } catch (error) {
    logger.error(`[queueTaskRun] Error: ${error.message || error}`);
    
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
      logger.error(`[queueTaskRun] Failed to update run status: ${updateError.message}`);
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
app.post('/api/run-task', authMiddleware, requireAutomationRun, automationLimiter, async (req, res) => {
  const { url, title, notes, type, task, username, password, pdf_url } = req.body;
  const user = req.user;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    logger.info(`[run-task] Processing automation for user ${user.id}`);
    
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
      logger.error('[run-task] Error creating automation task:', taskError);
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
      logger.error('[run-task] Error creating automation run:', runError);
      return res.status(500).json({ error: 'Failed to create automation run' });
    }
    
  // Queue the task processing - await it to ensure it's dispatched before responding
    // This prevents tasks from getting stuck in "running" state
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
      
      logger.info(`[run-task] Successfully queued task ${run.id} for processing`);
    } catch (error) {
      logger.error('[run-task] Error queueing task:', error?.message || error);
      // Update run status to failed
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          result: JSON.stringify({ error: 'Failed to queue task', message: error?.message || String(error) })
        })
        .eq('id', run.id);
      
      return res.status(500).json({ 
        error: 'Failed to queue task for processing',
        details: error?.message || String(error)
      });
    }

    return res.status(200).json({
      id: run.id,
      status: 'queued',
      message: 'Task queued for processing'
    });
    
  } catch (error) {
    logger.error('[run-task] Unhandled error:', error.message || error);
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
  const status = await taskStatusStore.get(task_id);
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
app.post('/api/notifications/create', authMiddleware, requireFeature('priority_support'), async (req, res) => {
  try {
    const { type, title, body, priority = 'normal', data = {} } = req.body || {};
    if (!type || !title || !body) {
      return res.status(400).json({ error: 'type, title and body are required' });
    }

    const notification = { type, title, body, priority, data };

    if (!firebaseNotificationService || !firebaseNotificationService.isConfigured) {
      logger.warn('[POST /api/notifications/create] Firebase not fully configured; attempting store only');
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
    logger.error('[POST /api/notifications/create] error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// --- Task Management API ---

// GET /api/tasks - Fetch all automation tasks for the user
app.get('/api/tasks', async (req, res) => {
  try {
    // Defensive check to ensure auth middleware has attached the user.
    if (!req.user || !req.user.id) {
      logger.error('[GET /api/tasks] Error: req.user is not defined. This indicates the Authorization header is missing or was stripped by a proxy.');
      // Log headers for debugging, but be careful with sensitive data in production logs.
      logger.error('[GET /api/tasks] Request Headers:', JSON.stringify(req.headers));
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
    logger.error('[GET /api/tasks] Error:', err.message);
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
    logger.error('[POST /api/tasks] Error:', err.message);
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
    // ✅ SECURITY: Validate URLs to prevent SSRF
    if (task.url) {
      const urlValidation = isValidUrl(task.url);
      if (!urlValidation.valid) {
        logger.warn(`[POST /api/tasks/${taskId}/run] Invalid URL rejected: ${task.url} (reason: ${urlValidation.reason})`);
        return res.status(400).json({ 
          error: urlValidation.reason === 'private-ip' ? 'Private IP addresses are not allowed' : 'Invalid URL format' 
        });
      }
    }
    if (task.parameters?.pdf_url) {
      const pdfUrlValidation = isValidUrl(task.parameters.pdf_url);
      if (!pdfUrlValidation.valid) {
        logger.warn(`[POST /api/tasks/${taskId}/run] Invalid PDF URL rejected: ${task.parameters.pdf_url} (reason: ${pdfUrlValidation.reason})`);
        return res.status(400).json({ 
          error: pdfUrlValidation.reason === 'private-ip' ? 'Private IP addresses are not allowed' : 'Invalid PDF URL format' 
        });
      }
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
    logger.info(`[POST /api/tasks/${taskId}/run] Received result from automation service:`, JSON.stringify(result, null, 2));

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
      logger.info(`🔔 Task completion notification sent for task ${taskData.name} to user ${req.user.id}`);
    } catch (notificationError) {
      logger.error('🔔 Failed to send task completion notification:', notificationError.message);
    }

    res.json({ message: 'Task executed successfully', runId, result });

  } catch (err) {
    // Log the full error object for more detailed debugging information.
    logger.error(`[POST /api/tasks/${taskId}/run] Error:`, err);

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
          logger.info(`🔔 Task failure notification sent for task ${taskData.name} to user ${req.user.id}`);
        } catch (notificationError) {
          logger.error('🔔 Failed to send task failure notification:', notificationError.message);
        }
      } catch (dbErr) {
        // Log the full database error for better diagnostics if the failure update itself fails.
        logger.error(`[POST /api/tasks/${taskId}/run] DB error update failed:`, dbErr);
      }
    }
    
    // Return a more structured error response to the client.
    res.status(500).json({ error: 'Failed to run task', details: err.message, runId: runId || null });
  }
});

// GET /api/runs - Fetch all automation runs for the user
app.get('/api/runs', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  logger.info('[GET /api/runs] Request received', {
    user_id: req.user?.id,
    has_user: !!req.user,
    path: req.path,
    method: req.method
  });

  try {
    // Defensive check
    if (!req.user || !req.user.id) {
      logger.warn('[GET /api/runs] No user in request', {
        has_user: !!req.user,
        user_id: req.user?.id
      });
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }

    if (!supabase) {
      logger.error('[GET /api/runs] Supabase not available');
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // ✅ PERFORMANCE: Optimize query - fetch without expensive join first
    // Then fetch task details separately if needed
    const { data: runsData, error } = await supabase
      .from('automation_runs')
      .select(`
        id,
        status,
        started_at,
        ended_at,
        result,
        artifact_url,
        task_id
      `)
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    // Fetch task details separately to avoid slow join
    const taskIds = [...new Set(runsData.filter(r => r.task_id).map(r => r.task_id))];
    let tasksMap = {};
    
    if (taskIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from('automation_tasks')
        .select('id, name, url, task_type')
        .in('id', taskIds);
      
      if (!tasksError && tasks) {
        tasksMap = tasks.reduce((acc, task) => {
          acc[task.id] = { name: task.name, url: task.url, task_type: task.task_type };
          return acc;
        }, {});
      }
    }
    
    // Merge task data into runs
    const data = runsData.map(run => ({
      id: run.id,
      status: run.status,
      started_at: run.started_at,
      ended_at: run.ended_at,
      result: run.result,
      artifact_url: run.artifact_url,
      automation_tasks: run.task_id ? tasksMap[run.task_id] || null : null
    }));
    
    const duration = Date.now() - startTime;
    logger.info('[GET /api/runs] Success', {
      user_id: req.user.id,
      runs_count: data?.length || 0,
      duration_ms: duration
    });
    res.json(data || []);
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('[GET /api/runs] Error', {
      error: err.message,
      stack: err.stack,
      user_id: req.user?.id,
      duration_ms: duration
    });
    res.status(500).json({ error: 'Failed to fetch runs', details: err.message });
  }
});

// GET /api/queue/status - Get queue status and task positions
app.get('/api/queue/status', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  logger.info('📋 [Queue] Status request received', {
    user_id: userId
  });

  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // Get all queued/running tasks for this user
    const { data: queuedTasks, error: tasksError } = await supabase
      .from('automation_runs')
      .select('id, status, started_at, task_id, result')
      .eq('user_id', userId)
      .in('status', ['running']) // Tasks with status 'running' but result says 'queued'
      .order('started_at', { ascending: true }); // Oldest first

    if (tasksError) throw tasksError;

    // Filter to only tasks that are actually queued (check result field)
    const actuallyQueued = (queuedTasks || []).filter(task => {
      try {
        const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
        return result?.status === 'queued' || result?.queue_status === 'pending' || !result;
      } catch {
        return !task.result; // If no result, assume queued
      }
    });

    // Check Kafka/worker health
    const { getKafkaService } = require('./utils/kafkaService');
    const kafkaService = getKafkaService();
    const kafkaConnected = kafkaService?.isConnected || false;
    
    // Check worker health (automation service)
    let workerHealthy = false;
    let workerResponseTime = null;
    try {
      const automationUrl = process.env.AUTOMATION_URL;
      if (automationUrl) {
        const axios = require('axios');
        const healthStart = Date.now();
        const normalizedUrl = automationUrl.trim().startsWith('http') ? automationUrl : `http://${automationUrl}`;
        await axios.get(`${normalizedUrl}/health`, { timeout: 3000 }).catch(() => {
          return axios.get(normalizedUrl, { timeout: 3000, validateStatus: () => true });
        });
        workerResponseTime = Date.now() - healthStart;
        workerHealthy = true;
      }
    } catch (e) {
      logger.warn('📋 [Queue] Worker health check failed', {
        error: e.message,
        user_id: userId
      });
    }

    // Calculate queue position for each task
    const queueInfo = actuallyQueued.map((task, index) => {
      const queuedAt = new Date(task.started_at);
      const waitTimeMs = Date.now() - queuedAt.getTime();
      const waitTimeMinutes = Math.floor(waitTimeMs / 60000);
      const waitTimeSeconds = Math.floor((waitTimeMs % 60000) / 1000);
      
      // Estimate processing time (average 30 seconds per task, 3 workers = ~10 seconds per task)
      const avgProcessingTimeSeconds = 10;
      const tasksAhead = index;
      const estimatedWaitSeconds = tasksAhead * avgProcessingTimeSeconds;
      
      return {
        task_id: task.id,
        position: index + 1,
        queued_at: task.started_at,
        wait_time_seconds: Math.floor(waitTimeMs / 1000),
        wait_time_display: waitTimeMinutes > 0 
          ? `${waitTimeMinutes}m ${waitTimeSeconds}s`
          : `${waitTimeSeconds}s`,
        estimated_wait_seconds: estimatedWaitSeconds,
        estimated_wait_display: estimatedWaitSeconds < 60
          ? `${estimatedWaitSeconds}s`
          : `${Math.floor(estimatedWaitSeconds / 60)}m`,
        is_stuck: waitTimeMs > 600000 // > 10 minutes
      };
    });

    const duration = Date.now() - startTime;
    logger.info('📋 [Queue] Status retrieved', {
      user_id: userId,
      queued_count: actuallyQueued.length,
      kafka_connected: kafkaConnected,
      worker_healthy: workerHealthy,
      worker_response_ms: workerResponseTime,
      duration_ms: duration
    });

    res.json({
      queue_health: {
        kafka_connected: kafkaConnected,
        worker_healthy: workerHealthy,
        worker_response_ms: workerResponseTime,
        total_queued: actuallyQueued.length
      },
      tasks: queueInfo,
      estimated_processing_rate: '~10 seconds per task (3 workers)',
      message: actuallyQueued.length === 0 
        ? 'No tasks in queue'
        : workerHealthy && kafkaConnected
          ? `${actuallyQueued.length} task(s) queued and processing`
          : 'Tasks queued but worker may be unavailable'
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('❌ [Queue] Status error', {
      error: err.message,
      user_id: userId,
      duration_ms: duration,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to get queue status', details: err.message });
  }
});

// GET /api/dashboard - Fetch dashboard statistics
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  logger.info('📊 [Dashboard] Request received', {
    user_id: userId,
    has_user: !!req.user,
    path: req.path,
    method: req.method
  });

  try {
    // Defensive check
    if (!req.user || !req.user.id) {
      logger.warn('📊 [Dashboard] No user in request', {
        has_user: !!req.user,
        user_id: userId
      });
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }

    if (!supabase) {
      logger.error('📊 [Dashboard] Supabase not available');
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // ✅ PERFORMANCE: Optimize query - fetch without expensive join first
    // Then fetch task details separately if needed (similar to /api/runs)
    const queryStartTime = Date.now();
    
    // Perform all queries in parallel for efficiency
    const [tasksCount, runsCount, recentRunsData] = await Promise.all([
      supabase.from('automation_tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('automation_runs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('automation_runs')
        .select('id, status, started_at, result, artifact_url, task_id')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(10) // Limit to 10 most recent for dashboard
    ]);

    if (tasksCount.error) throw tasksCount.error;
    if (runsCount.error) throw runsCount.error;
    if (recentRunsData.error) throw recentRunsData.error;
    
    // Fetch task details separately to avoid slow join
    const taskIds = [...new Set((recentRunsData.data || []).filter(r => r.task_id).map(r => r.task_id))];
    let tasksMap = {};
    
    if (taskIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from('automation_tasks')
        .select('id, name, url, task_type')
        .in('id', taskIds);
      
      if (!tasksError && tasks) {
        tasksMap = tasks.reduce((acc, task) => {
          acc[task.id] = { name: task.name, url: task.url, task_type: task.task_type };
          return acc;
        }, {});
      }
    }
    
    // Merge task data into runs
    const recentRuns = (recentRunsData.data || []).map(run => ({
      id: run.id,
      status: run.status,
      started_at: run.started_at,
      result: run.result,
      artifact_url: run.artifact_url,
      automation_tasks: tasksMap[run.task_id] || null
    }));
    
    const queryDuration = Date.now() - queryStartTime;
    const totalDuration = Date.now() - startTime;
    
    logger.info('✅ [Dashboard] Data fetched successfully', {
      user_id: userId,
      query_duration_ms: queryDuration,
      total_duration_ms: totalDuration,
      totalTasks: tasksCount.count,
      totalRuns: runsCount.count,
      recentRuns_count: recentRuns.length
    });
    
    // Log performance warning if query is slow
    if (queryDuration > 2000) {
      logger.warn('⚠️ [Dashboard] Slow query detected', {
        user_id: userId,
        query_duration_ms: queryDuration,
        threshold_ms: 2000
      });
    }

    res.json({
      totalTasks: tasksCount.count || 0,
      totalRuns: runsCount.count || 0,
      recentRuns: recentRuns,
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('❌ [Dashboard] Error fetching dashboard data', {
      error: err.message,
      error_code: err.code,
      user_id: userId,
      duration_ms: duration,
      stack: err.stack
    });
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
    logger.error(`[DELETE /api/tasks/${req.params.id}] Error:`, err.message);
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
});

// GET /api/usage/debug - Debug user usage data
app.get('/api/usage/debug', authMiddleware, requireFeature('advanced_analytics'), async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info(`[DEBUG] Checking usage for user: ${req.user.id}`);

    // Check if user_usage table exists
    let tableExists = false;
    try {
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', req.user.id)
        .single();
      
      tableExists = !usageError || usageError.code !== '42P01';
      logger.info(`[DEBUG] user_usage table exists: ${tableExists}`);
      logger.info(`[DEBUG] Current usage record:`, usageData);
    } catch (e) {
      logger.info(`[DEBUG] user_usage table check error:`, e.message);
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
    logger.error('[GET /api/usage/debug] Error:', error);
    res.status(500).json({ error: 'Debug failed', details: error.message });
  }
});

// GET /api/usage/refresh - Refresh user usage metrics
app.post('/api/usage/refresh', authMiddleware, requireFeature('advanced_analytics'), async (req, res) => {
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
      logger.error('[POST /api/usage/refresh] Upsert error:', upsertError);
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
    logger.error('[POST /api/usage/refresh] Error:', error);
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
    logger.error('[GET /api/subscription] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription data', details: err.message });
  }
});

// GET /api/schedules - Fetch workflow schedules for the authenticated user
app.get('/api/schedules', authMiddleware, requireFeature('scheduled_automations'), async (req, res) => {
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
      logger.error('[GET /api/schedules] Database error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch schedules',
        details: error.message 
      });
    }

    res.json(schedules || []);
  } catch (err) {
    logger.error('[GET /api/schedules] Error:', err.message);
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
    // Support both 'event_name' and 'event' for backward compatibility
    const { user_id, event_name, event, properties, utm } = req.body || {};
    const finalEventName = event_name || event;
    if (!finalEventName) return res.status(400).json({ error: 'event_name or event is required' });

    if (supabase) {
      await supabase.from('marketing_events').insert([{ user_id: user_id || null, event_name: finalEventName, properties: properties || {}, utm: utm || {}, created_at: new Date().toISOString() }]);
    }

    // Optionally forward to external analytics asynchronously
    (async () => {
      try {
        if (process.env.MIXPANEL_TOKEN && process.env.NODE_ENV !== 'test') {
          // Basic Mixpanel HTTP ingestion (lite) - non-blocking
          const mp = {
            event: finalEventName,
            properties: Object.assign({ token: process.env.MIXPANEL_TOKEN, distinct_id: user_id || null, time: Math.floor(Date.now() / 1000) }, properties || {}, { utm: utm || {} }),
          };
          await axios.post('https://api.mixpanel.com/track', { data: Buffer.from(JSON.stringify([mp])).toString('base64') }, { timeout: 3000 });
        }
      } catch (e) {
        logger.warn('[track-event] forward failed', e?.message || e);
      }
    })();

    return res.json({ ok: true });
  } catch (e) {
    logger.error('[POST /api/track-event] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Batch tracking endpoint - handles multiple events in a single request
app.post('/api/track-event/batch', async (req, res) => {
  try {
    const { events } = req.body || {};
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    // Process events in parallel
    const eventPromises = events.map(async (eventData) => {
      // Support both 'event_name' and 'event' for backward compatibility
      const { user_id, event_name, event, properties, utm } = eventData || {};
      const finalEventName = event_name || event;
      if (!finalEventName) {
        logger.warn('[track-event/batch] Skipping event without event_name:', eventData);
        return null;
      }

      try {
        if (supabase) {
          await supabase.from('marketing_events').insert([{ 
            user_id: user_id || null, 
            event_name: finalEventName, 
            properties: properties || {}, 
            utm: utm || {}, 
            created_at: new Date().toISOString() 
          }]);
        }

        // Optionally forward to external analytics asynchronously
        if (process.env.MIXPANEL_TOKEN && process.env.NODE_ENV !== 'test') {
          (async () => {
            try {
              const mp = {
                event: finalEventName,
                properties: Object.assign({ 
                  token: process.env.MIXPANEL_TOKEN, 
                  distinct_id: user_id || null, 
                  time: Math.floor(Date.now() / 1000) 
                }, properties || {}, { utm: utm || {} }),
              };
              await axios.post('https://api.mixpanel.com/track', { 
                data: Buffer.from(JSON.stringify([mp])).toString('base64') 
              }, { timeout: 3000 });
            } catch (e) {
              logger.warn('[track-event/batch] Mixpanel forward failed', e?.message || e);
            }
          })();
        }

        return { success: true, event_name: finalEventName };
      } catch (e) {
        logger.warn('[track-event/batch] Failed to process event:', e?.message || e);
        return { success: false, event_name: finalEventName, error: e?.message };
      }
    });

    const results = await Promise.allSettled(eventPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - successful;

    return res.json({ 
      ok: true, 
      processed: results.length,
      successful,
      failed 
    });
  } catch (e) {
    logger.error('[POST /api/track-event/batch] error', e?.message || e);
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
      logger.error('[enqueue-email] db error', JSON.stringify(error, null, 2));
      // In non-production show details to help diagnose; DO NOT enable this in production
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ error: 'db error', details: error });
      }
      return res.status(500).json({ error: 'db error' });
    }
    return res.json({ ok: true });
  } catch (e) {
    logger.error('[POST /api/enqueue-email] error', e?.message || e);
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
      logger.info(`[ensureUserProfile] Creating missing profile for user ${userId}, email: ${email}`);
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          email: email,
          created_at: new Date().toISOString()
        }]);
      
      if (insertError) {
        logger.error('[ensureUserProfile] Failed to create profile:', insertError);
        throw insertError;
      }
      logger.info(`[ensureUserProfile] Successfully created profile for user ${userId}`);
    }
    return true;
  } catch (error) {
    logger.error('[ensureUserProfile] Error:', error);
    throw error;
  }
}

// Trigger a small campaign sequence for the authenticated user (example: welcome series)
app.post('/api/trigger-campaign', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) {
      logger.info('[trigger-campaign] No user found on request');
      return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    }
    const { campaign, to_email } = req.body || {};
    logger.info(`[trigger-campaign] Received request: campaign=${campaign}, to_email=${to_email}, user_id=${req.user.id}`);
    if (!campaign) {
      logger.info('[trigger-campaign] No campaign specified');
      return res.status(400).json({ error: 'campaign is required' });
    }

    // Enhanced email lookup with multiple strategies
    let targetEmail = to_email || null;
    if (!targetEmail) {
      logger.info('[trigger-campaign] Looking up user email - trying multiple sources...');
      
      // Strategy 1: Try profiles table (existing logic)
      try {
        if (supabase) {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', req.user.id)
            .maybeSingle();
          logger.info('[trigger-campaign] Profile lookup result:', { profile, pErr });
          if (pErr) logger.warn('[trigger-campaign] profile lookup error', pErr.message || pErr);
          if (profile && profile.email) {
            targetEmail = profile.email;
            logger.info(`[trigger-campaign] Found target email from profile: ${targetEmail}`);
          } else {
            logger.info('[trigger-campaign] No email found in profiles table');
          }
        }
      } catch (e) {
        logger.warn('[trigger-campaign] profile lookup failed', e?.message || e);
      }
    }
    
    // Strategy 2: Try auth.users table if still no email
    if (!targetEmail && supabase) {
      try {
        logger.info('[trigger-campaign] Trying auth.users table...');
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(req.user.id);
        
        if (authUser && authUser.user && authUser.user.email) {
          targetEmail = authUser.user.email;
          logger.info('[trigger-campaign] Found email in auth.users:', targetEmail);
        } else {
          logger.info('[trigger-campaign] No email in auth.users');
        }
      } catch (e) {
        logger.info('[trigger-campaign] Auth.users lookup failed:', e.message);
      }
    }
    
    // Strategy 3: Try req.user.email directly
    if (!targetEmail && req.user.email) {
      targetEmail = req.user.email;
      logger.info('[trigger-campaign] Using email from req.user:', targetEmail);
    }
    
    // Strategy 4: Try user_metadata
    if (!targetEmail && req.user.user_metadata && req.user.user_metadata.email) {
      targetEmail = req.user.user_metadata.email;
      logger.info('[trigger-campaign] Using email from user_metadata:', targetEmail);
    }

    // Strategy 5: Debug user object to see available data
    if (!targetEmail) {
      logger.info('[trigger-campaign] Available user data:', JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        user_metadata: req.user.user_metadata,
        app_metadata: req.user.app_metadata,
        aud: req.user.aud,
        role: req.user.role
      }, null, 2));
    }

    if (!targetEmail) {
      logger.info('[trigger-campaign] Target email not found after all strategies');
      return res.status(400).json({ 
        error: 'target email not found',
        debug: 'User authenticated but no email address found in profiles, auth.users, or user object'
      });
    }

    try {
  await ensureUserProfile(req.user.id, targetEmail);
} catch (profileError) {
  logger.error('[trigger-campaign] Failed to ensure user profile:', profileError);
  return res.status(500).json({ 
    error: 'Failed to prepare user profile for email campaign',
    note: 'User profile creation failed'
  });
}

    logger.info(`[trigger-campaign] Final target email: ${targetEmail}`);

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
          logger.info(`[trigger-campaign] Creating contact in HubSpot: ${targetEmail}`, hubspotPayload);
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
          logger.info(`[trigger-campaign] Successfully created contact ${targetEmail} in HubSpot. Response:`, hubspotRes.status, hubspotRes.data);
        } catch (hubspotError) {
          logger.error('[trigger-campaign] HubSpot error:', hubspotError?.response?.status, hubspotError?.response?.data, hubspotError.message);
          // If contact already exists (409), update them instead.
          if (hubspotError.response?.status === 409 && hubspotError.response?.data?.message) {
            logger.info(`[trigger-campaign] Contact ${targetEmail} already exists. Attempting update.`);
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
                logger.info(`[trigger-campaign] Updating contact in HubSpot: ${contactId}`, updatePayload);
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
                logger.info(`[trigger-campaign] Successfully updated contact ${targetEmail} in HubSpot. Response:`, updateRes.status, updateRes.data);
              } else {
                logger.warn(`[trigger-campaign] Failed to parse contact ID from HubSpot error: ${message}`);
              }
            } catch (updateError) {
              logger.error(`[trigger-campaign] Failed to update contact ${targetEmail} in HubSpot:`, updateError.message, updateError?.response?.data);
            }
          } else {
            logger.error(`[trigger-campaign] Failed to create contact ${targetEmail} in HubSpot:`, hubspotError.message, hubspotError?.response?.data);
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
        logger.info(`[trigger-campaign] Enqueuing welcome and followup emails for ${targetEmail}`, inserts);
        break;
      default:
        // Handle other campaigns if you add them
        logger.info(`[trigger-campaign] Unknown campaign: ${campaign}`);
        break;
    }

    if (inserts.length > 0 && supabase) {
      const { error } = await supabase
        .from('email_queue')
        .insert(inserts);

      if (error) {
        logger.error('[trigger-campaign] DB insert failed:', error.message, error);
        return res.status(500).json({ error: 'Failed to enqueue emails.', note: 'Failed to enqueue emails.' });
      }
      logger.info(`[trigger-campaign] Successfully enqueued ${inserts.length} emails for campaign ${campaign}`);
      
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
          logger.info(`🔔 Welcome notification sent to user ${req.user.id}`);
        } catch (notificationError) {
          logger.error('🔔 Failed to send welcome notification:', notificationError.message);
        }
      }
    } else if (!supabase) {
      logger.warn('[trigger-campaign] No Supabase client available - emails not enqueued');
    } else {
      logger.info(`[trigger-campaign] No emails enqueued for campaign ${campaign}`);
    }

    return res.json({ ok: true, enqueued: inserts.length });
  } catch (e) {
    logger.error('[POST /api/trigger-campaign] error', e?.message || e, e);
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
        accepted_types: ['web_automation', 'form_submission', 'data_extraction', 'file_download', 'invoice_download']
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
    logger.error('[POST /api/automation/queue] error:', error);
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
  // ✅ CRITICAL: Log immediately when endpoint is hit
  // ✅ OBSERVABILITY: Use structured logging with trace context
  logger.info('🚨 Automation execute endpoint hit', {
    user_id: req.user?.id,
    timestamp: new Date().toISOString(),
    operation: 'automation_execute'
  });
  
  try {
    const taskData = req.body;

    // DEV: Log incoming payload for debugging
    // ✅ OBSERVABILITY: Log incoming request with structured data
    logger.debug('Incoming automation request', {
      task_type: taskData.task_type,
      url: taskData.url,
      has_credentials: !!(taskData.username || taskData.password),
      discovery_method: taskData.discoveryMethod
    });
    if (process.env.NODE_ENV !== 'production') {
      logger.info('[DEV DEBUG] Incoming /api/automation/execute payload:', JSON.stringify(taskData, null, 2));
    }

    // Validate payload
    if (!taskData || typeof taskData !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('[DEV DEBUG] Missing or invalid request body:', taskData);
      }
      return res.status(400).json({
        error: 'Request body must be a JSON object with required fields.'
      });
    }
    if (!taskData.task_type) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('[DEV DEBUG] Missing task_type in request body:', taskData);
      }
      return res.status(400).json({
        error: 'task_type is required',
        accepted_types: ['web_automation', 'form_submission', 'data_extraction', 'file_download', 'invoice_download']
      });
    }
    if (!taskData.url && ['web_automation', 'form_submission', 'data_extraction', 'file_download', 'invoice_download'].includes(taskData.task_type)) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('[DEV DEBUG] Missing url in request body for task_type', taskData.task_type, taskData);
      }
      return res.status(400).json({
        error: 'url is required for this task_type.'
      });
    }

    // ✅ SEAMLESS UX: Handle Invoice Download with Link Discovery (automatic fallback)
    if (taskData.task_type === 'invoice_download' && taskData.discoveryMethod) {
      logger.info(`[AutomationExecute] Processing invoice download with link discovery for user ${req.user.id}`);
      
      try {
        // Validate required fields for discovery
        const { url, username, password, discoveryMethod, discoveryValue } = taskData;
        
        if (!username || !password) {
          return res.status(400).json({
            error: 'Username and password are required for invoice download with link discovery'
          });
        }

        if (discoveryMethod === 'css-selector' && !discoveryValue) {
          return res.status(400).json({
            error: 'CSS Selector is required when using css-selector method'
          });
        }

        if (discoveryMethod === 'text-match' && !discoveryValue) {
          return res.status(400).json({
            error: 'Link Text is required when using text-match method'
          });
        }

        logger.info(`[AutomationExecute] Starting link discovery for ${url} with method: ${discoveryMethod}`);
        
        // ✅ SEAMLESS UX: Run link discovery with automatic fallback
        const linkDiscovery = new LinkDiscoveryService();
        let discoveryResult = await linkDiscovery.discoverPdfLinks({
          url,
          username,
          password,
          discoveryMethod,
          discoveryValue,
          testMode: false
        });
        
        // ✅ SEAMLESS UX: If primary method fails, automatically try auto-detect as fallback
        if (!discoveryResult.success && discoveryMethod !== 'auto-detect') {
          logger.info(`[AutomationExecute] Primary method (${discoveryMethod}) found no links, trying auto-detect fallback...`);
          const fallbackResult = await linkDiscovery.discoverPdfLinks({
            url,
            username,
            password,
            discoveryMethod: 'auto-detect',
            discoveryValue: null,
            testMode: false
          });
          
          if (fallbackResult.success && fallbackResult.discoveredLinks?.length > 0) {
            logger.info(`[AutomationExecute] Fallback auto-detect succeeded! Found ${fallbackResult.discoveredLinks.length} links`);
            discoveryResult = fallbackResult;
            discoveryResult.fallback_used = true;
            discoveryResult.original_method = discoveryMethod;
          }
        }

        if (!discoveryResult.success || !discoveryResult.discoveredLinks?.length) {
          // ✅ UX IMPROVEMENT: More helpful error with actionable guidance
          const testSitePatterns = [
            'jsonplaceholder.typicode.com',
            'httpbin.org',
            'reqres.in'
          ];
          const isTestSite = testSitePatterns.some(pattern => url.includes(pattern));
          
          // Get what WAS found (even if not PDFs) to help user understand what happened
          const foundLinks = discoveryResult.discoveredLinks || [];
          const allLinksFound = discoveryResult.allLinksFound || discoveryResult.diagnosticInfo?.totalLinksOnPage || 0;
          const pageTitle = discoveryResult.pageTitle || 'the page';
          
          let errorMessage;
          let suggestion;
          
          if (isTestSite) {
            errorMessage = 'No PDF download links found. Test sites (like JSON Placeholder, HttpBin, ReqRes) typically don\'t contain PDF files.';
            suggestion = 'For testing, you can provide a direct PDF URL in the "PDF URL" field instead of using link discovery.';
          } else if (allLinksFound > 0) {
            // Found links but no PDFs - helpful!
            errorMessage = `Found ${allLinksFound} link(s) on "${pageTitle}", but none appear to be PDF downloads. The page may not have PDF files, or they might be behind a different navigation path.`;
            suggestion = 'Try: 1) Navigating to a page that lists invoices/downloads, 2) Using a different discovery method (CSS selector or text match), or 3) Providing a direct PDF URL if you know it.';
          } else {
            // No links found at all
            errorMessage = 'No downloadable links found on the page. This could mean: the page structure is different than expected, login didn\'t complete successfully, or the page loaded incorrectly.';
            suggestion = 'Try: 1) Verifying your login credentials work, 2) Checking that you\'re on the right page (one that should have download links), 3) Using a CSS selector or text match discovery method, or 4) Providing a direct PDF URL.';
          }
          
          // ✅ UX IMPROVEMENT: Don't block - allow fallback to direct PDF URL
          // BUT: Still create database record so task appears in history
          // We'll continue with the normal flow but mark it as a warning
          logger.warn(`[AutomationExecute] Link discovery failed but continuing to create database record`);
          taskData.link_discovery_failed = true;
          taskData.link_discovery_error = errorMessage;
          taskData.link_discovery_warning = true;
          taskData.discovery_info = {
              links_found: allLinksFound,
              pdf_links_found: foundLinks.length,
              page_title: pageTitle,
              discovery_method: discoveryMethod,
              page_url: discoveryResult.pageUrl
          };
          // Don't return early - continue to database insert and Kafka queue
          // The task will be created but marked as having a discovery warning
        } else {
          // Link discovery succeeded
        logger.info(`[AutomationExecute] Link discovery successful, found ${discoveryResult.discoveredLinks.length} links`);

        // Use the best discovered link (first one with highest score)
        const bestLink = discoveryResult.discoveredLinks[0];
        taskData.pdf_url = bestLink.href;
        taskData.discovered_links = discoveryResult.discoveredLinks;
        taskData.discovery_method_used = discoveryMethod;
          
          // ✅ SEAMLESS UX: Pass cookies for authenticated PDF downloads
          if (discoveryResult.cookies && discoveryResult.cookies.length > 0) {
            taskData.auth_cookies = discoveryResult.cookies;
            taskData.cookie_string = discoveryResult.cookieString;
            logger.info(`[AutomationExecute] Extracted ${discoveryResult.cookies.length} cookies for authenticated download`);
          }
        
        logger.info(`[AutomationExecute] Using discovered PDF URL: ${bestLink.href.substring(0, 100)}...`);
        }
        
      } catch (discoveryError) {
        logger.error('[AutomationExecute] Link discovery failed with exception:', discoveryError);
        // ✅ FIX: Don't return early - continue to create database record
        // Mark the task as having a discovery error but still process it
        taskData.link_discovery_failed = true;
        taskData.link_discovery_error = discoveryError.message;
        taskData.link_discovery_exception = true;
        logger.warn('[AutomationExecute] Link discovery exception but continuing to create database record');
      }
    }

    // Add user context to task
    const enrichedTask = {
      ...taskData,
      user_id: req.user.id,
      created_at: new Date().toISOString(),
      source: 'backend-api'
    };

    if (process.env.NODE_ENV !== 'production') {
      logger.info('[DEV DEBUG] /api/automation/execute enriched payload:', JSON.stringify(enrichedTask, null, 2));
    }

    // ✅ FIX: Create database records so task appears in automation history
    // ✅ OBSERVABILITY: Log database insert attempt with trace context
    // ✅ FIX: Declare taskType before using it in logger
    const taskType = (taskData.task_type || 'general').toLowerCase();
    const taskName = taskData.title || 
                     (taskData.task_type && taskData.task_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())) || 
                     'Automation Task';
    
    logger.debug('Starting database insert for automation task', {
      supabase_configured: !!supabase,
      user_id: req.user?.id,
      task_type: taskType
    });
    
    // Create automation_tasks record
    const taskParams = {
      url: taskData.url || '',
      username: taskData.username || '',
      password: taskData.password || '',
      pdf_url: taskData.pdf_url || '',
      discoveryMethod: taskData.discoveryMethod || '',
      discoveryValue: taskData.discoveryValue || '',
      enableAI: taskData.enableAI || false,
      extractionTargets: taskData.extractionTargets || []
    };
    
    let taskRecord = null;
    let runRecord = null;
    let dbError = null;
    
    // ✅ FIX: Check if Supabase is configured before attempting database operations
    if (!supabase) {
      dbError = 'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.';
      // ✅ OBSERVABILITY: Log Supabase configuration error with full context
      logger.error('Supabase client is null/undefined', null, {
        supabase_type: typeof supabase,
        supabase_exists: !!supabase,
        env_check: {
          SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
          SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'MISSING',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
          SUPABASE_KEY: process.env.SUPABASE_KEY ? 'SET' : 'MISSING',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
        }
      });
      logger.error(`[AutomationExecute] ❌ ${dbError} - Task will be processed via Kafka but won't appear in history.`);
    } else {
      // ✅ OBSERVABILITY: Supabase client verified
      logger.debug('Supabase client verified, proceeding with database insert');
      try {
        // ✅ OBSERVABILITY: Log task insert attempt
        logger.debug('Inserting automation task record', {
          user_id: req.user.id,
          task_name: taskName,
          task_type: taskType
        });
        
        const insertResult = await supabase
          .from('automation_tasks')
          .insert([{
            user_id: req.user.id,
            name: taskName,
            description: taskData.notes || taskData.description || '',
            url: taskData.url || '',
            task_type: taskType,
            parameters: JSON.stringify(taskParams),
            is_active: true
          }])
          .select()
          .single();
        
        // ✅ OBSERVABILITY: Log insert result (already logged above)
        
        const { data: task, error: taskError } = insertResult;
        
        if (taskError) {
          // ✅ OBSERVABILITY: Log task insert error with full context
          logger.error('Failed to insert automation task', taskError, {
            user_id: req.user.id,
            task_name: taskName,
            task_type: taskType,
            error_code: taskError.code,
            error_message: taskError.message
          });
          // ✅ FIX: Log the FULL error object so we can see what's wrong
          const errorDetails = {
            message: taskError.message,
            details: taskError.details,
            hint: taskError.hint,
            code: taskError.code,
            fullError: JSON.stringify(taskError, Object.getOwnPropertyNames(taskError))
          };
          logger.error('[AutomationExecute] ❌ Error creating automation task:', errorDetails);
          // Error already logged above with full context
          dbError = `Database error: ${taskError.message || 'Failed to create task record'}`;
          if (taskError.details) dbError += ` (${taskError.details})`;
          if (taskError.hint) dbError += ` Hint: ${taskError.hint}`;
          if (taskError.code) dbError += ` [Code: ${taskError.code}]`;
        } else {
          taskRecord = task;
          logger.info(`[AutomationExecute] ✅ Created automation task ${task.id} for user ${req.user.id}`);
          
          // Create automation_runs record
          // ✅ FIX: Valid statuses are 'running', 'completed', 'failed' - NOT 'queued'
          // We use 'running' initially (even though task is queued) because that's what the constraint allows
          // The result field contains the actual queue status, and Kafka will update the DB status when processing starts/completes
          const { data: run, error: runError } = await supabase
            .from('automation_runs')
            .insert([{
              task_id: taskRecord.id,
              user_id: req.user.id,
              status: 'running',  // DB constraint only allows: 'running', 'completed', 'failed'
              started_at: new Date().toISOString(),
              result: JSON.stringify({ 
                status: 'queued',  // Actual status in result metadata
                message: 'Task queued for processing',
                queue_status: 'pending'  // Additional metadata for UI display
              })
            }])
            .select()
            .single();
          
          if (runError) {
            // ✅ FIX: Log the FULL error object so we can see what's wrong
            const errorDetails = {
              message: runError.message,
              details: runError.details,
              hint: runError.hint,
              code: runError.code,
              fullError: JSON.stringify(runError, Object.getOwnPropertyNames(runError))
            };
            logger.error('[AutomationExecute] ❌ Error creating automation run:', errorDetails);
            // ✅ OBSERVABILITY: Error already logged above with full context
            dbError = dbError ? `${dbError}; Run error: ${runError.message}` : `Database error: ${runError.message || 'Failed to create run record'}`;
            if (runError.details) dbError += ` (${runError.details})`;
            if (runError.hint) dbError += ` Hint: ${runError.hint}`;
            if (runError.code) dbError += ` [Code: ${runError.code}]`;
          } else {
            runRecord = run;
            logger.info(`[AutomationExecute] ✅ Created automation run ${run.id} for task ${taskRecord.id}`);
          }
        }
      } catch (dbException) {
        logger.error('[AutomationExecute] Unexpected error creating database records:', {
          error: dbException,
          message: dbException.message,
          stack: dbException.stack
        });
        dbError = `Unexpected database error: ${dbException.message || String(dbException)}`;
      }
    }
    
    // ✅ OBSERVABILITY: Log final database error status
    if (dbError) {
      logger.error('Database insert failed for automation task', new Error(dbError), {
        has_task_record: !!taskRecord,
        has_run_record: !!runRecord,
        supabase_status: supabase ? 'initialized' : 'NULL/UNDEFINED',
        env_variables: {
          SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
          SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'MISSING',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
          SUPABASE_KEY: process.env.SUPABASE_KEY ? 'SET' : 'MISSING',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
        },
        user_id: req.user?.id
      });
      
      logger.error(`[AutomationExecute] ❌ Database insert FAILED: ${dbError}`);
      logger.error(`[AutomationExecute] ❌ Supabase client status: ${supabase ? 'initialized' : 'NULL/UNDEFINED'}`);
      logger.error(`[AutomationExecute] ❌ Environment check: SUPABASE_URL=${!!process.env.SUPABASE_URL}, SUPABASE_SERVICE_ROLE=${!!process.env.SUPABASE_SERVICE_ROLE}, SUPABASE_SERVICE_ROLE_KEY=${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    } else {
      logger.debug('[AutomationExecute] ✅ Database insert succeeded!');
    }

    // Send task asynchronously (fire-and-forget)
    let task_id;
    try {
      // ✅ OBSERVABILITY: Log Kafka send attempt
      logger.debug('Attempting to send task to Kafka', {
        task_id: task_id,
        task_type: taskType
      });
      const result = await kafkaService.sendAutomationTask(enrichedTask);
      task_id = result.taskId;
      // ✅ OBSERVABILITY: Log successful Kafka send
      logger.info('Task sent to Kafka successfully', {
        task_id: task_id,
        task_type: taskType,
        kafka_enabled: true
      });
    } catch (kafkaError) {
      // ✅ OBSERVABILITY: Log Kafka send failure
      logger.error('Failed to send task to Kafka', kafkaError, {
        task_id: task_id,
        task_type: taskType,
        user_id: req.user?.id
      });
      logger.error('[AutomationExecute] Kafka send failed:', kafkaError);
      // Generate a task_id anyway so the response is valid
      task_id = enrichedTask.task_id || uuidv4();
      // Continue - task will be queued but won't process until Kafka is fixed
    }

    // Store initial status in Redis/memory
    await taskStatusStore.set(task_id, {
      status: 'queued',
      result: null,
      updated_at: new Date().toISOString(),
      user_id: req.user.id,
      task: enrichedTask,
      // ✅ FIX: Link to database records
      task_record_id: taskRecord?.id,
      run_record_id: runRecord?.id
    });

    const dbRecorded = !!runRecord;
    
    logger.debug('[AutomationExecute] 🔍 BEFORE BUILDING RESPONSE', {
      dbRecorded,
      hasRunRecord: !!runRecord,
      hasTaskRecord: !!taskRecord,
      hasDbError: !!dbError,
      dbErrorValue: dbError
    });
    
    // ✅ FIX: Always include db_error_details if database insert failed
    const response = {
      success: true,
      task_id,
      status: 'queued',
      message: 'Task accepted and queued for execution.',
      // ✅ FIX: Return database IDs so frontend can track the task
      run_id: runRecord?.id || null,
      task_record_id: taskRecord?.id || null,
      // ✅ FIX: Include database status with FULL error details
      db_recorded: dbRecorded,
      db_warning: dbError || (dbRecorded ? null : 'Database record creation failed - no error details available')
    };
    
    // ✅ FIX: ALWAYS include db_error_details if db_recorded is false OR if there's an error
    // This is CRITICAL - we MUST include error details so frontend can show what went wrong
    if (!dbRecorded || dbError) {
      const errorDetails = {
        message: dbError || 'Database record creation failed - unknown error',
        supabase_configured: !!supabase,
        supabase_exists: !!supabase,
        can_retry: false,
        env_check: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_KEY: !!process.env.SUPABASE_KEY,
          SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
        },
        task_record_created: !!taskRecord,
        run_record_created: !!runRecord,
        debug_info: {
          dbError_set: !!dbError,
          dbError_value: dbError || 'not set',
          supabase_type: typeof supabase,
          dbRecorded_value: dbRecorded
        }
      };
      
      // ✅ CRITICAL: Force set the property - don't rely on conditional
      response.db_error_details = errorDetails;
      
      logger.error('[AutomationExecute] ❌ INCLUDING ERROR DETAILS IN RESPONSE', null, {
        error_details: errorDetails,
        has_db_error_details: !!response.db_error_details,
        db_error_details_type: typeof response.db_error_details,
        db_error_details_keys: response.db_error_details ? Object.keys(response.db_error_details) : 'N/A'
      });
    } else {
      // ✅ SAFETY: Even if dbRecorded is true, log that we're NOT including error details
      logger.debug('[AutomationExecute] ✅ Database insert succeeded - NOT including error details');
    }
    
    // ✅ CRITICAL SAFETY CHECK: Force include error details if db_recorded is false, regardless of any other condition
    if (!response.db_recorded && !response.db_error_details) {
      logger.error('[AutomationExecute] ⚠️ SAFETY CHECK: db_recorded is false but db_error_details missing! Adding it now...');
      response.db_error_details = {
        message: 'Database record creation failed - error details were not captured',
        supabase_configured: !!supabase,
        supabase_exists: !!supabase,
        can_retry: false,
        env_check: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        task_record_created: !!taskRecord,
        run_record_created: !!runRecord,
        debug_info: {
          safety_check_triggered: true,
          dbError_set: !!dbError,
          dbError_value: dbError || 'not set'
        }
      };
    }
    
    logger.debug('[AutomationExecute] 🔍 FINAL RESPONSE BEFORE SENDING', {
      success: response.success,
      task_id: response.task_id,
      db_recorded: response.db_recorded,
      has_db_error_details: !!response.db_error_details,
      db_error_details_keys: response.db_error_details ? Object.keys(response.db_error_details) : 'N/A',
      db_warning: response.db_warning,
      response_keys: Object.keys(response)
    });
    
    // ✅ CRITICAL: Verify the response before sending (debug only - sampled)
    const responseString = JSON.stringify(response);
    logger.debug('[AutomationExecute] 🔍 Response verification', {
      response_length: responseString.length,
      includes_db_error_details: responseString.includes('db_error_details'),
      first_1000_chars: responseString.substring(0, 1000)
    });
    
    // ✅ FIX: If link discovery failed, include that info in the response
    if (taskData.link_discovery_failed) {
      response.link_discovery_warning = true;
      response.link_discovery_error = taskData.link_discovery_error;
      response.fallback_available = true;
      response.fallback_message = 'You can still submit this task by providing a direct PDF URL in the "PDF URL" field.';
      if (taskData.discovery_info) {
        response.discovery_info = taskData.discovery_info;
      }
    }
    
    logger.debug('[AutomationExecute] 📤 SENDING RESPONSE NOW');
    
    res.status(202).json(response);

  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      logger.error('[DEV DEBUG] /api/automation/execute error:', error);
    } else {
      logger.error('[POST /api/automation/execute] error:', error.message);
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
    logger.error('[POST /api/trigger-automation] error:', error);
    res.status(500).json({
      error: 'Failed to trigger automation',
      details: error.message
    });
  }
});

// Consolidated Session Endpoint - Returns plan, preferences, and notifications in one call
// This reduces initial API calls from 3+ to 1, preventing rate limiting issues
app.get('/api/user/session', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all data in parallel for better performance
    const [planResult, preferencesResult, notificationsResult] = await Promise.allSettled([
      // Fetch plan data
      (async () => {
        try {
          const { resolveUserPlan } = require('./services/userPlanResolver');
          const { planData } = await resolveUserPlan(userId, { normalizeMissingPlan: false });
          return { success: true, planData };
        } catch (error) {
          logger.warn('[GET /api/user/session] Plan fetch failed:', error?.message);
          return { success: false, error: error?.message };
        }
      })(),
      
      // Fetch preferences
      (async () => {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            throw error;
          }
          
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
          
          return { success: true, preferences };
        } catch (error) {
          logger.warn('[GET /api/user/session] Preferences fetch failed:', error?.message);
          return { success: false, error: error?.message };
        }
      })(),
      
      // Fetch notifications
      (async () => {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            throw error;
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
          
          return { success: true, notifications: notificationSettings };
        } catch (error) {
          logger.warn('[GET /api/user/session] Notifications fetch failed:', error?.message);
          return { success: false, error: error?.message };
        }
      })()
    ]);
    
    // Extract results (handle both fulfilled and rejected promises)
    const plan = planResult.status === 'fulfilled' ? planResult.value : { success: false, error: planResult.reason?.message };
    const preferences = preferencesResult.status === 'fulfilled' ? preferencesResult.value : { success: false, error: preferencesResult.reason?.message };
    const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : { success: false, error: notificationsResult.reason?.message };
    
    // Build consolidated response
    const response = {
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email
      },
      plan: plan.planData || null,
      preferences: preferences.preferences || null,
      notifications: notifications.notifications || null,
      // Include partial success indicators if any fetch failed
      _partial: {
        plan: !plan.success,
        preferences: !preferences.success,
        notifications: !notifications.success
      }
    };
    
    // Set cache headers
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
    
    res.json(response);
    
  } catch (error) {
    logger.error('[GET /api/user/session] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
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
      logger.error('[GET /api/user/preferences] error:', error);
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
    logger.error('[GET /api/user/preferences] error:', error);
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
      logger.error('[PUT /api/user/preferences] update error details:', {
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

    logger.info(`[PUT /api/user/preferences] Updated preferences for user ${req.user.id}`);
    res.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences: updateData 
    });

  } catch (error) {
    logger.error('[PUT /api/user/preferences] unexpected error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user notification settings (specific endpoint for notification preferences)
app.get('/api/user/notifications', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('[GET /api/user/notifications] missing authenticated user');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!supabase) {
      logger.error('[GET /api/user/notifications] Supabase client not initialized');
      return res.status(500).json({ error: 'Database connection not available' });
    }
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('[GET /api/user/notifications] error querying user_settings:', error && error.stack ? error.stack : error);
      // Return safe defaults rather than failing entirely to avoid 500s from transient DB issues
      const defaultSettings = {
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
      const payload = { ...defaultSettings };
      if (process.env.NODE_ENV !== 'production') payload.debug = { dbError: error?.message || String(error) };
      return res.json(payload);
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
    logger.error('[GET /api/user/notifications] error:', error && error.stack ? error.stack : error);
    // Provide helpful error details in non-production environments
    const payload = { error: 'Internal server error' };
    if (process.env.NODE_ENV !== 'production') payload.details = error?.message || String(error);
    res.status(500).json(payload);
  }
});

// Update notification preferences
app.put('/api/user/notifications', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('[PUT /api/user/notifications] missing authenticated user');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!supabase) {
      logger.error('[PUT /api/user/notifications] Supabase client not initialized');
      return res.status(500).json({ error: 'Database connection not available' });
    }
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
      logger.error('[PUT /api/user/notifications] supabase upsert error:', error && error.stack ? error.stack : error);
      const payload = { error: 'Failed to update notification preferences' };
      if (process.env.NODE_ENV !== 'production') payload.details = error?.message || String(error);
      return res.status(500).json(payload);
    }

    logger.info(`[PUT /api/user/notifications] Updated notification preferences for user ${req.user.id}`);
    res.json({ 
      success: true, 
      message: 'Notification preferences updated successfully' 
    });

  } catch (error) {
    logger.error('[PUT /api/user/notifications] unexpected error:', error && error.stack ? error.stack : error);
    const payload = { error: 'Internal server error' };
    if (process.env.NODE_ENV !== 'production') payload.details = error?.message || String(error);
    res.status(500).json(payload);
  }
});

// Get user plan data
/**
 * GET /api/user/plan
 * 
 * Returns user's plan, usage, limits, and features.
 * 
 * REFACTOR PLAN (implemented):
 * 1. Extract plan resolution to userPlanResolver service (single responsibility)
 * 2. Centralize default Hobbyist plan definition (DRY principle)
 * 3. Add explicit fallback handling with structured warnings (rate-limited)
 * 4. Implement proper ETag-based caching (only 304 when effective plan unchanged)
 * 5. Reduce production logging (only log metadata, not full JSON)
 * 6. Add validation for all plan fields
 * 
 * Response includes metadata about fallback usage (visible in dev, hidden in prod).
 */
app.get('/api/user/plan', authMiddleware, async (req, res) => {
  const { resolveUserPlan, generatePlanETag } = require('./services/userPlanResolver');
  
  try {
    const userId = req.user.id;
    logger.info('[GET /api/user/plan] Fetching plan data', { userId });
    
    // Resolve plan with fallback handling
    // Set normalizeMissingPlan=true to auto-fix invalid plan_ids (optional)
    const { planData, metadata } = await resolveUserPlan(userId, {
      normalizeMissingPlan: false // TODO: Set to true to auto-normalize invalid plans
    });
    
    // Generate ETag based on effective plan state
    const etag = generatePlanETag(planData);
    
    // Check if client has current version (HTTP 304 Not Modified)
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      logger.info('[GET /api/user/plan] Client has current plan (304)', { 
        userId,
        etag 
      });
      return res.status(304).end();
    }
    
    // Log summary (not full JSON in production)
    if (process.env.NODE_ENV === 'production') {
      logger.info('[GET /api/user/plan] Plan resolved', {
        userId,
        planName: planData.plan.name,
        workflows: planData.usage.workflows,
        monthlyRuns: planData.usage.monthly_runs,
        usedFallback: metadata.used_fallback
      });
    } else {
      // Development: log full details
      logger.info('[GET /api/user/plan] Plan resolved (dev)', {
        userId,
        planData: JSON.stringify(planData),
        metadata: JSON.stringify(metadata)
      });
    }
    
    // Build response
    const response = {
      success: true,
      planData
    };
    
    // In development, include metadata about fallback
    if (process.env.NODE_ENV !== 'production' && metadata.used_fallback) {
      response._metadata = {
        warning: 'Fallback plan used',
        reason: metadata.fallback_reason,
        stored_plan_id: metadata.stored_plan_id
      };
    }
    
    // Set ETag header for caching
    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
    
    res.json(response);
    
  } catch (error) {
    logger.error('[GET /api/user/plan] Unexpected error', error, { 
      userId: req.user?.id,
      error_code: error.code || 'UNKNOWN',
      error_message: error.message
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
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
    const userId = req.user?.id;
    
    // Validate userId before proceeding
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      logger.error('🔥 Invalid user ID for Firebase token generation:', { userId, type: typeof userId });
      return res.status(400).json({
        error: 'Invalid user ID',
        code: 'INVALID_UID',
        message: 'User ID must be a non-empty string'
      });
    }
    
    if (userId.length > 128) {
      logger.error('🔥 User ID too long for Firebase token:', { userId, length: userId.length });
      return res.status(400).json({
        error: 'User ID too long',
        code: 'UID_TOO_LONG',
        message: 'User ID must be 128 characters or less'
      });
    }
    
    const { additionalClaims } = req.body || {};

    logger.info(`🔥 Generating Firebase custom token for user: ${userId}`);

    // Generate custom token using the Firebase Admin service
    const result = await firebaseNotificationService.generateCustomToken(userId, additionalClaims);

    if (!result.success) {
      logger.error(`🔥 Failed to generate token for user ${userId}:`, result.error, { code: result.code });
      return res.status(500).json({
        error: 'Failed to generate Firebase token',
        details: result.error,
        code: result.code || 'TOKEN_GENERATION_FAILED'
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
        logger.warn(`🔥 Failed to create Firebase user record for ${userId}:`, userResult.error);
        // Don't fail the request, token generation succeeded
      }
    }

    logger.info(`🔥 Successfully generated Firebase token for user: ${userId}`);

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
    logger.error('[POST /api/firebase/token] error:', error);
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

    logger.info(`🔥 Verifying Firebase ID token for user: ${req.user.id}`);

    const result = await firebaseNotificationService.verifyCustomToken(idToken);

    if (!result.success) {
      logger.error(`🔥 Token verification failed:`, result.error);
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
    logger.error('[POST /api/firebase/verify-token] error:', error);
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

    logger.info(`🔥 Updating Firebase claims for user ${userId}:`, userClaims);

    const result = await firebaseNotificationService.setUserClaims(userId, userClaims);

    if (!result.success) {
      logger.error(`🔥 Failed to set claims for user ${userId}:`, result.error);
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
    logger.error('[PUT /api/firebase/claims] error:', error);
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
      logger.error('[admin/email-queue-stats] Database error:', error.message);
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
    logger.error('[admin/email-queue-stats] Unexpected error:', e?.message || e);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: e?.message || 'Unknown error' 
    });
  }
});

// =====================================================
// FILE MANAGEMENT API ENDPOINTS
// =====================================================

// GET /api/files/debug/buckets - Debug endpoint to check bucket status
app.get('/api/files/debug/buckets', authMiddleware, async (req, res) => {
  try {
    logger.info('[DEBUG] Checking Supabase storage buckets');
    
    // Try to list buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      logger.error('[DEBUG] Error listing buckets:', bucketsError);
      return res.json({
        error: 'Failed to list buckets',
        details: bucketsError,
        message: 'Check if Supabase storage is configured correctly'
      });
    }
    
    // Try to list files in user-files bucket
    const { data: files, error: filesError } = await supabase.storage
      .from('user-files')
      .list(req.user.id, { limit: 5 });
    
    res.json({
      buckets: buckets || [],
      userFilesBucket: {
        exists: !filesError,
        error: filesError,
        sampleFiles: files || []
      },
      userId: req.user.id
    });
  } catch (err) {
    logger.error('[DEBUG] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/files/upload - Upload a new file
app.post('/api/files/upload', authMiddleware, checkStorageLimit, async (req, res) => {
  logger.info('[FILE UPLOAD] Starting file upload process');
  try {
    if (!req.files || !req.files.file) {
      logger.info('[FILE UPLOAD] Error: No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.files.file;
    const userId = req.user.id;
    logger.info(`[FILE UPLOAD] File: ${file.name}, Size: ${file.size}, User: ${userId}`);
    
    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = path.extname(file.name).toLowerCase();
    const baseName = path.basename(file.name, fileExt);
    const safeName = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const filePath = `${userId}/${timestamp}_${safeName}${fileExt}`;
    
    // Upload to Supabase storage
    logger.info(`[FILE UPLOAD] Uploading to Supabase storage: ${filePath}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-files')
      .upload(filePath, file.data, {
        contentType: file.mimetype,
        upsert: false
      });
      
    if (uploadError) {
      logger.error('[FILE UPLOAD] Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }
    logger.info(`[FILE UPLOAD] Storage upload successful: ${uploadData?.path}`);
    
    // Calculate MD5 checksum
    const checksum = crypto.createHash('md5').update(file.data).digest('hex');
    
    // Save metadata to files table
    logger.info(`[FILE UPLOAD] Saving metadata to database for file: ${file.name}`);
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
    logger.info(`[FILE UPLOAD] Metadata object:`, JSON.stringify(fileMetadata, null, 2));
    
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert(fileMetadata)
      .select()
      .single();
      
    if (dbError) {
      logger.error('[FILE UPLOAD] Database insert error:', dbError);
      logger.error('[FILE UPLOAD] Database error details:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      });
      // Clean up uploaded file if database insert fails
      logger.info(`[FILE UPLOAD] Cleaning up uploaded file: ${filePath}`);
      await supabase.storage.from('user-files').remove([filePath]);
      return res.status(500).json({ error: 'Failed to save file metadata' });
    }
    logger.info(`[FILE UPLOAD] Database insert successful: ${fileRecord.id}`);

    // Track storage usage
    await usageTracker.trackStorageUsage(userId, filePath, 'added', file.size);

    logger.info(`[FILE UPLOAD] Upload completed successfully for file: ${file.name}`);
    res.status(201).json({
      ...fileRecord,
      message: 'File uploaded successfully'
    });
    
  } catch (err) {
    logger.error('[FILE UPLOAD] Unexpected error:', err);
    logger.error('[FILE UPLOAD] Stack trace:', err.stack);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/files - Get user's files
app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { folder, limit = 50, offset = 0, search, tags, category } = req.query;
    
    logger.info(`[GET /api/files] Fetching files for user ${userId}`, {
      folder,
      limit,
      offset,
      search,
      tags,
      category,
      userAuthenticated: !!req.user
    });
    
    let query = supabase
      .from('files')
      .select('*')
      .eq('user_id', userId);
      // Removed .is('expires_at', null) to show all files, including those with expiration dates

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
      logger.error('[GET /api/files] Files query error:', error);
      logger.error('[GET /api/files] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ error: 'Failed to fetch files', details: error.message });
    }

    logger.info(`[GET /api/files] Found ${data?.length || 0} files for user ${userId}`, {
      fileCount: data?.length || 0,
      hasFiles: (data?.length || 0) > 0,
      firstFileHasId: data?.[0]?.id ? true : false
    });
    
    res.json({ files: data || [] });
    
  } catch (err) {
    logger.error('[GET /api/files] Unexpected error:', err);
    logger.error('[GET /api/files] Stack trace:', err.stack);
    res.status(500).json({ error: 'Failed to fetch files', details: err.message });
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
      logger.error('[GET /api/files/:id/download] File not found:', { fileId: req.params.id, userId: req.user.id, error });
      return res.status(404).json({ error: 'File not found' });
    }

    logger.info('[GET /api/files/:id/download] Attempting download:', { 
      fileId: file.id, 
      bucket: file.storage_bucket, 
      path: file.storage_path,
      fileName: file.original_name 
    });

    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600);

    if (urlError) {
      logger.error('[GET /api/files/:id/download] Signed URL error:', { 
        bucket: file.storage_bucket, 
        path: file.storage_path,
        error: urlError,
        errorDetails: JSON.stringify(urlError),
        supabaseError: {
          message: urlError.message,
          statusCode: urlError.statusCode,
          error: urlError.error
        }
      });
      // Return the actual Supabase error to help debug
      return res.status(urlError.statusCode || 500).json({ 
        error: 'Failed to generate download URL',
        message: urlError.message || 'Storage error',
        statusCode: urlError.statusCode,
        details: urlError,
        hint: 'Check if the file exists in storage and bucket is accessible'
      });
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
    logger.error('[GET /api/files/:id/download] Error:', err.message);
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
      logger.error('Database deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete file record' });
    }

    res.json({ message: 'File deleted successfully' });
    
  } catch (err) {
    logger.error('[DELETE /api/files/:id] Error:', err.message);
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
      logger.error('Share creation error:', shareError);
      return res.status(500).json({ error: 'Failed to create share link' });
    }

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${shareToken}`;

    res.status(201).json({
      ...share,
      shareUrl,
      permissions: share.permissions || permission, // Ensure permissions field is included
      password_hash: undefined // Don't return password hash
    });

  } catch (err) {
    logger.error('[POST /api/files/shares] Error:', err.message);
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
      logger.error('Shares query error:', sharesError);
      return res.status(500).json({ error: 'Failed to fetch shares' });
    }

    // Add share URLs and remove password hashes
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${share.share_token}`,
      permissions: share.permissions || 'view', // Ensure permissions field is included
      password_hash: undefined
    }));

    res.json({ shares: sharesWithUrls });

  } catch (err) {
    logger.error('[GET /api/files/:id/shares] Error:', err.message);
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
    logger.error('[PUT /api/files/shares/:shareId] Error:', err.message);
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
      logger.error('Share deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete share' });
    }

    res.json({ message: 'Share deleted successfully' });

  } catch (err) {
    logger.error('[DELETE /api/files/shares/:shareId] Error:', err.message);
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
        logger.error('Signed URL error:', urlError);
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
      logger.info(`File shared access: ${share.files.original_name} accessed via share link`);
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
    logger.error('[POST /api/shared/access] Error:', err.message);
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
  logger.warn('[Enhanced Features] Services not available:', error.message);
}

// POST /api/extract-data - AI-powered data extraction
app.post('/api/extract-data', authMiddleware, upload.single('file'), async (req, res) => {
  if (!aiDataExtractor) {
    return res.status(503).json({ error: 'AI extraction service not available' });
  }

  try {
    const { extractionType, targets, fileId } = req.body;
    const file = req.file;
    const userId = req.user.id;

    // Handle fileId: fetch file from database and download from storage
    let fileBuffer = file?.buffer;
    let fileName = file?.originalname;
    
    if (fileId && !file) {
      // Fetch file metadata from database
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (fileError || !fileRecord) {
        return res.status(404).json({ error: 'File not found' });
      }

      fileName = fileRecord.original_name || fileRecord.name;

      // Download file from Supabase storage
      try {
        const bucket = fileRecord.storage_bucket || 'user-files';
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from(bucket)
          .download(fileRecord.storage_path || fileRecord.name);

        if (downloadError) {
          logger.error('[extract-data] Failed to download file from storage:', downloadError);
          return res.status(500).json({ error: 'Failed to download file from storage' });
        }

        // Convert blob to buffer
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      } catch (storageError) {
        logger.error('[extract-data] Storage download error:', storageError);
        return res.status(500).json({ error: 'Failed to download file' });
      }
    }

    if (!fileBuffer && !req.body.htmlContent) {
      return res.status(400).json({ error: 'File or HTML content required' });
    }

    let extractionResult;

    // Determine extraction type if 'auto'
    const actualExtractionType = extractionType === 'auto' 
      ? (fileBuffer && (fileName?.toLowerCase().endsWith('.pdf') || fileName?.match(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i)) ? 'invoice' : 'webpage')
      : extractionType;

    try {
      if (actualExtractionType === 'invoice' && fileBuffer) {
        extractionResult = await aiDataExtractor.extractInvoiceData(fileBuffer, fileName);
      } else if (actualExtractionType === 'webpage' && req.body.htmlContent) {
        const extractionTargets = JSON.parse(targets || '[]');
        extractionResult = await aiDataExtractor.extractWebPageData(req.body.htmlContent, extractionTargets);
      } else {
        return res.status(400).json({ error: 'Invalid extraction type or missing data' });
      }
    } catch (extractionError) {
      // Re-throw rate limit errors with status code preserved
      if (extractionError.statusCode === 429) {
        throw extractionError;
      }
      // Re-throw other errors
      throw extractionError;
    }

    // Save extraction results to files table if file was processed
    if (extractionResult.success && (file || fileId)) {
      try {
        const updateData = {
          extracted_data: extractionResult.structuredData,
          ai_confidence: extractionResult.metadata?.confidence,
          processing_status: 'completed'
        };

        if (fileId) {
          await supabase
            .from('files')
            .update(updateData)
            .eq('id', fileId)
            .eq('user_id', userId);
        } else if (file) {
          await supabase
            .from('files')
            .update(updateData)
            .eq('user_id', userId)
            .eq('original_name', file.originalname);
        }
      } catch (dbError) {
        logger.warn('[extract-data] Failed to update database:', dbError.message);
      }
    }

    res.json({
      success: true,
      extractionResult
    });

  } catch (error) {
    logger.error('[extract-data] Error:', error);
    
    // Handle specific error types
    let statusCode = 500;
    let errorMessage = error.message || 'Failed to extract data';
    
    // Check if it's a rate limit error from OpenAI
    if (error.response?.status === 429 || error.message?.includes('rate limit') || error.message?.includes('429')) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. The AI extraction service is temporarily busy. Please wait a moment and try again.';
    } else if (error.response?.status === 503 || error.message?.includes('service unavailable')) {
      statusCode = 503;
      errorMessage = 'AI extraction service is currently unavailable. Please try again later.';
    } else if (error.response?.status === 400) {
      statusCode = 400;
      errorMessage = error.message || 'Invalid file format or extraction request.';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Enhanced task form - Add AI extraction to existing tasks
app.post('/api/run-task-with-ai', authMiddleware, requireAutomationRun, automationLimiter, async (req, res) => {
  const { url, title, notes, type, task, username, password, pdf_url, enableAI, extractionTargets } = req.body;
  const user = req.user;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    logger.info(`[run-task-with-ai] Processing AI-enhanced automation for user ${user.id}`);
    
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
      logger.error('[run-task-with-ai] Error creating automation task:', taskError);
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
      logger.error('[run-task-with-ai] Error creating automation run:', runError);
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
            logger.error('[run-task-with-ai] AI extraction failed:', aiError);
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
        logger.error('[run-task-with-ai] Enhanced automation failed:', error);
        
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
    logger.error('[run-task-with-ai] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk processing endpoints
app.post('/api/bulk-process/invoices', authMiddleware, requirePlan('professional'), async (req, res) => {
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
    logger.error('[bulk-process] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Extract data from multiple files
app.post('/api/extract-data-bulk', authMiddleware, requirePlan('professional'), async (req, res) => {
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
    logger.error('[extract-data-bulk] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Integration endpoints
app.get('/api/integrations', authMiddleware, requireFeature('custom_integrations'), async (req, res) => {
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
    logger.error('[integrations] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/integrations/sync-files', authMiddleware, requireFeature('custom_integrations'), async (req, res) => {
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
    logger.error('[sync-files] Error:', error);
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

    logger.info('Looking up plan with ID:', planId);
    
    // Fetch plan details - try by id first, then by name
    let { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
      
    // If not found by ID, try by name (in case frontend sends name instead of UUID)
    if (planError && planError.code === 'PGRST116') {
      logger.info('Plan not found by ID, trying by name...');
      const { data: planByName, error: nameError } = await supabase
        .from('plans')
        .select('*')
        .eq('name', planId)
        .single();
      
      if (!nameError && planByName) {
        plan = planByName;
        planError = null;
        logger.info('Found plan by name:', plan.name);
      }
    }

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

    // Log for debugging
    logger.info('Creating Polar checkout with data:', JSON.stringify(checkoutData, null, 2));
    
    const response = await axios.post('https://api.polar.sh/v1/checkouts/', checkoutData, {
      headers: {
        'Authorization': `Bearer ${polarApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info('Polar checkout response:', response.data);
    const checkoutUrl = response.data.url;
    
    res.json({ 
      checkout_url: checkoutUrl,
      trial_days: 14,
      plan_name: plan.name
    });

  } catch (error) {
    logger.error('Error creating Polar checkout:', error);
    if (error.response) {
      logger.error('Polar API Error:', error.response.data);
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
  logger.error(err.stack);
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
