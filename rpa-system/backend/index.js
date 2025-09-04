const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const csrf = require('csurf');
const crypto = require('crypto');
+// Load environment variables from the backend/.env file (absolute, not CWD-dependent)
+require('dotenv').config({ path: require('path').join(__dirname, '.env') });
 const { createClient } = require('@supabase/supabase-js');
 const fs = require('fs');
 const morgan = require('morgan');
 const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;

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
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "https:"], // Removed data: protocol
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"], // Block object/embed
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"], // Block frames
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

// --- Supabase & App Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;
if (!supabase) {
  console.warn('⚠️ Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE environment variables.');
}
const ARTIFACTS_BUCKET = process.env.SUPABASE_BUCKET || 'artifacts';
const USE_SIGNED_URLS = (process.env.SUPABASE_USE_SIGNED_URLS || 'true').toLowerCase() !== 'false';
const SIGNED_URL_EXPIRES = Math.max(60, parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || '86400', 10));
const DOWNLOADS_DIR_CONTAINER = process.env.DOWNLOADS_DIR_CONTAINER || '/downloads';
const DOWNLOADS_DIR_HOST = process.env.DOWNLOADS_DIR_HOST || (process.cwd().includes('/workspace') ? '/workspace/downloads' : path.join(process.cwd(), 'downloads'));


// CORS: allow all in dev (when no whitelist provided); restrict in prod
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true); // dev fallback
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info'],
}));

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

// POST /api/run-task - Secured automation endpoint
app.post('/api/run-task', automationLimiter, async (req, res) => {
  try {
    // Defensive check for authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!supabase) return res.status(500).json({ error: 'Database connection not available' });

    const { task, url, username, password } = req.body || {};
    
    // Input sanitization
    const sanitizedTask = sanitizeInput(task);
    const sanitizedUrl = sanitizeInput(url);
    const sanitizedUsername = sanitizeInput(username);
    
    if (!sanitizedUrl) return res.status(400).json({ error: 'url is required' });

    // URL validation
    const urlValidation = isValidUrl(sanitizedUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({ 
        error: 'Invalid URL', 
        reason: urlValidation.reason 
      });
    }

    // Rate limiting check (plan-based)
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(403).json({ error: 'No active subscription found' });
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('feature_flags')
      .eq('id', subscription.plan_id)
      .single();

    if (planError) return res.status(500).json({ error: 'Could not verify plan limits' });

    const maxRuns = plan.feature_flags?.max_runs_per_month;
    if (maxRuns !== -1) {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      let count = 0;
      let countError = null;
      try {
        const countRes = await supabase
          .from('automation_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', req.user.id)
          .gte('created_at', startDate);
        count = countRes.count;
        countError = countRes.error;
      } catch (err) {
        countError = err;
      }

      // Change this section
if (countError) {
  // Log the error but don't fail the request
  console.error('[run-task] Could not count recent runs:', countError.message || countError);
  // Continue processing instead of returning error
  // Only enforce limits if we successfully got the count
}

      if (count >= maxRuns) {
        return res.status(403).json({ error: 'Monthly run limit exceeded' });
      }
    }

    // Encrypt credentials if provided
    let encryptedCredentials = null;
    if (sanitizedUsername && password) {
      const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      if (!encryptionKey) {
        return res.status(500).json({ error: 'Server misconfiguration: encryption key not set' });
      }
      if (encryptionKey.length < 32) {
        return res.status(500).json({ error: 'Server misconfiguration: encryption key too short' });
      }
      encryptedCredentials = encryptCredentials({
        username: sanitizedUsername,
        password: password
      }, encryptionKey);
    }

    // Prepare payload for automation service
    const automationUrl = process.env.AUTOMATION_URL || 'http://localhost:7001/run';
    const automationApiKey = process.env.AUTOMATION_API_KEY;
    
    if (!automationApiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: automation API key not set' });
    }
    
    const payload = { 
      url: sanitizedUrl, 
      task: sanitizedTask,
      user_id: req.user.id,
      encrypted_credentials: encryptedCredentials
    };
    
    if (req.body && typeof req.body.pdf_url === 'string') {
      const sanitizedPdfUrl = sanitizeInput(req.body.pdf_url);
      const pdfUrlValidation = isValidUrl(sanitizedPdfUrl);
      if (pdfUrlValidation.valid) {
        payload.pdf_url = sanitizedPdfUrl;
      }
    }
    
    const response = await axios.post(automationUrl, payload, { 
      timeout: 120000,
      headers: {
        'Authorization': `Bearer ${automationApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const result = response.data?.result ?? null;

    // Upload artifact (PDF) to Supabase Storage if present
    let artifact_url = null;
    if (supabase && result && result.pdf) {
      try {
        const containerPath = result.pdf;
        const fileName = path.basename(containerPath);
        let hostPath = containerPath;
        if (containerPath.startsWith(DOWNLOADS_DIR_CONTAINER)) {
          hostPath = path.join(DOWNLOADS_DIR_HOST, fileName);
        }
        if (fs.existsSync(hostPath)) {
          const buffer = fs.readFileSync(hostPath);
          const key = `runs/${new Date().toISOString().slice(0,10)}/${Date.now()}_${fileName}`;
          const { error: upErr } = await supabase.storage.from(ARTIFACTS_BUCKET).upload(key, buffer, {
            contentType: 'application/pdf',
            upsert: true,
          });
          if (upErr) throw upErr;
          if (USE_SIGNED_URLS) {
            const { data: signed, error: signErr } = await supabase.storage
              .from(ARTIFACTS_BUCKET)
              .createSignedUrl(key, SIGNED_URL_EXPIRES);
            if (signErr) throw signErr;
            artifact_url = signed.signedUrl;
          } else {
            artifact_url = supabase.storage.from(ARTIFACTS_BUCKET).getPublicUrl(key).data.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('[run-task] artifact upload failed', storageErr.message);
      }
    }

    // Log the execution
    if (supabase) {
      try {
        await supabase.from('automation_logs').insert([{ 
          user_id: req.user.id,
          task: sanitizedTask, 
          url: sanitizedUrl, 
          username: sanitizedUsername, 
          result, 
          status: 'completed', 
          artifact_url, 
          created_at: new Date().toISOString() 
        }]);
      } catch (dbErr) {
        console.warn('[DB insert failed]', dbErr.message);
      }
    }

    res.json({ result, artifact_url });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || err.message;
    console.error('[POST /api/run-task] Error:', status, data);
    
    // Log failure
    if (supabase && req.user) {
      try {
        const body = req.body || {};
        await supabase.from('automation_logs').insert([{ 
          user_id: req.user.id,
          task: sanitizeInput(body.task), 
          url: sanitizeInput(body.url), 
          username: sanitizeInput(body.username), 
          result: { error: 'Execution failed' }, 
          status: 'failed', 
          created_at: new Date().toISOString() 
        }]);
      } catch (e) {
        console.warn('[DB insert failed - error path]', e.message);
      }
    }
    res.status(502).json({ error: 'Automation failed' });
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
    const automationUrl = process.env.AUTOMATION_URL || 'http://localhost:7001/run';
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

    if (updateError) throw updateError;

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

// Trigger a small campaign sequence for the authenticated user (example: welcome series)
app.post('/api/trigger-campaign', async (req, res) => {
  try {
    // Defensive check
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication failed: User not available on the request.' });
    const { campaign, to_email } = req.body || {};
    if (!campaign) return res.status(400).json({ error: 'campaign is required' });

    // Determine target email: optional override via body (useful for admin/testing)
    let targetEmail = to_email || null;
    if (!targetEmail) {
      try {
        const { data: profile, error: pErr } = await supabase.from('profiles').select('email').eq('id', req.user.id).maybeSingle();
        if (pErr) console.warn('[trigger-campaign] profile lookup error', pErr.message || pErr);
        if (profile && profile.email) {
          targetEmail = profile.email;
        }
      } catch (e) {
        console.warn('[trigger-campaign] profile lookup failed', e?.message || e);
      }
    }

    if (!targetEmail) return res.status(400).json({ error: 'target email not found' });

    // Add contact to HubSpot in the background (fire-and-forget), but not during tests.
    if (process.env.HUBSPOT_API_KEY && process.env.NODE_ENV !== 'test') {
      (async () => {
        try {
          const hubspotPayload = {
            properties: {
              email: targetEmail,
              lifecyclestage: 'lead',
              record_source: 'EasyFlow SaaS', // <-- Added here
            },
          };

          await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts',
            hubspotPayload,
            {
              headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log(`[trigger-campaign] Successfully created contact ${targetEmail} in HubSpot.`);
        } catch (hubspotError) {
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
                    record_source: 'EasyFlow SaaS', // <-- Added here
                  },
                };
                await axios.patch(
                  `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
                  updatePayload,
                  {
                    headers: {
                      'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                console.log(`[trigger-campaign] Successfully updated contact ${targetEmail} in HubSpot.`);
              } else {
                console.warn(`[trigger-campaign] Failed to parse contact ID from HubSpot error: ${message}`);
              }
            } catch (updateError) {
              console.error(`[trigger-campaign] Failed to update contact ${targetEmail} in HubSpot: ${updateError.message}`);
            }
          } else {
            console.error(`[trigger-campaign] Failed to create contact ${targetEmail} in HubSpot: ${hubspotError.message}`);
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
        break;
      default:
        // Handle other campaigns if you add them
        break;
    }

    if (inserts.length > 0) {
      const { error } = await supabase
        .from('email_queue')
        .insert(inserts);

      if (error) {
        console.error('[trigger-campaign] DB insert failed:', error.message);
        return res.status(500).json({ error: 'Failed to enqueue emails.', note: 'Failed to enqueue emails.' });
      }
    }

    return res.json({ ok: true, enqueued: inserts.length });
  } catch (e) {
    console.error('[POST /api/trigger-campaign] error', e?.message || e);
    return res.status(500).json({ error: 'internal', enqueued: 0, note: e.message || 'No additional error note provided.' });
  }
});

// Final error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export functions for testing
module.exports = app;
module.exports.sanitizeInput = sanitizeInput;
module.exports.isValidUrl = isValidUrl;
module.exports.encryptCredentials = encryptCredentials;
module.exports.decryptCredentials = decryptCredentials;
module.exports.sanitizeError = sanitizeError;