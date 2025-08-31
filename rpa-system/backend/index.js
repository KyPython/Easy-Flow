const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3030;
const hooksEmailRouter = require('./hooks_email_route')
const sendEmailRouter = require('./send_email_route');

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
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
}));

// The Polar webhook needs a raw body, so its route is defined later with special middleware.
// For all other routes, we'll use the JSON body parser. It must be registered before the routes.
app.use((req, res, next) => {
  if (req.path === '/polar-webhook' || req.originalUrl === '/polar-webhook') {
    return next();
  }
  return express.json()(req, res, next);
});

app.use(hooksEmailRouter);
app.use(sendEmailRouter);

// Serve static files from React build (if it exists)
const reactBuildPath = path.join(__dirname, '../rpa-dashboard/build');
if (fs.existsSync(reactBuildPath)) {
  app.use('/app', express.static(reactBuildPath));
  app.use('/app/*', (_req, res) => {
    res.sendFile(path.join(reactBuildPath, 'index.html'));
  });
}

// --- Auth Middleware (relaxed for testing) ---
app.use('/api', async (req, res, next) => {
  try {
    if (!supabase) return res.status(401).json({ error: 'Unauthorized - supabase not configured' });

    const authHeader = (req.get('authorization') || '').trim();
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized - missing bearer token' });

    // validate token via Supabase server client
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    // attach user to request for downstream handlers
    req.user = data.user;

    // RELAXED: skip subscription/trial enforcement for testing
    return next();

  } catch (err) {
    console.error('[auth middleware] error', err?.message || err);
    return res.status(500).json({ error: 'Internal auth error' });
  }
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = SUPABASE_URL && (SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY)
  : null;
const ARTIFACTS_BUCKET = process.env.SUPABASE_BUCKET || 'artifacts';
const USE_SIGNED_URLS = (process.env.SUPABASE_USE_SIGNED_URLS || 'true').toLowerCase() !== 'false';
const SIGNED_URL_EXPIRES = Math.max(60, parseInt(process.env.SUPABASE_SIGNED_URL_EXPIRES || '86400', 10));
const DOWNLOADS_DIR_CONTAINER = process.env.DOWNLOADS_DIR_CONTAINER || '/downloads';
const DOWNLOADS_DIR_HOST = process.env.DOWNLOADS_DIR_HOST || (process.cwd().includes('/workspace') ? '/workspace/downloads' : path.join(process.cwd(), 'downloads'));

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

// --- Task Management API ---

// GET /api/tasks - Fetch all automation tasks for the user
app.get('/api/tasks', async (req, res) => {
  try {
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

    // 4. Update the run record with the result
    const { error: updateError } = await supabase
      .from('automation_runs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        result: { message: 'Execution finished.', output: result },
      })
      .eq('id', runId);

    if (updateError) throw updateError;

    res.json({ message: 'Task executed successfully', runId, result });

  } catch (err) {
    console.error(`[POST /api/tasks/${taskId}/run] Error:`, err.message);

    // 5. If an error occurred, update the run record to 'failed'
    if (runId) {
      try {
        await supabase
          .from('automation_runs')
          .update({
            status: 'failed',
            ended_at: new Date().toISOString(),
            result: { error: err.message, details: err.response?.data },
          })
          .eq('id', runId);
      } catch (dbErr) {
        console.error(`[POST /api/tasks/${taskId}/run] DB error update failed:`, dbErr.message);
      }
    }
    
    res.status(500).json({ error: 'Failed to run task', details: err.message });
  }
});

// GET /api/runs - Fetch all automation runs for the user
app.get('/api/runs', async (req, res) => {
  try {
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

// GET /api/plans - Fetch all available subscription plans
app.get('/api/plans', async (req, res) => {
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

// GET /api/subscription - Fetch user's current subscription and usage
app.get('/api/subscription', async (req, res) => {
  try {
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

app.post('/api/run-task', async (req, res) => {
  try {
    const { task, url, username, password } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

  // Prefer localhost for local dev; Docker compose sets AUTOMATION_URL=http://automation:7001/run
  const automationUrl = process.env.AUTOMATION_URL || 'http://localhost:7001/run';
  const payload = { url, username, password, task };
  if (req.body && typeof req.body.pdf_url === 'string') payload.pdf_url = req.body.pdf_url;
  const response = await axios.post(automationUrl, payload, { timeout: 120000 });

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
            artifact_url = signed?.signedUrl || null;
          } else {
            const { data: pub } = supabase.storage.from(ARTIFACTS_BUCKET).getPublicUrl(key);
            artifact_url = pub?.publicUrl || null;
          }
        } else {
          console.warn('[artifact upload] file not found:', hostPath);
        }
      } catch (upErr) {
        console.warn('[artifact upload failed]', upErr.message);
      }
    }

  if (supabase) {
      try {
    await supabase.from('automation_logs').insert([{ task, url, username, result, status: 'completed', artifact_url, created_at: new Date().toISOString() }]);
      } catch (dbErr) {
        console.warn('[DB insert failed]', dbErr.message);
      }
    }

  res.json({ result, artifact_url });
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || err.message;
    console.error('[POST /api/run-task] Error:', status, data);
    // Attempt to log failure
    if (supabase) {
      try {
        const body = req.body || {};
        await supabase.from('automation_logs').insert([{ task: body.task, url: body.url, username: body.username, result: { error: data }, status: 'failed', created_at: new Date().toISOString() }]);
      } catch (e) {
        console.warn('[DB insert failed - error path]', e.message);
      }
    }
    res.status(502).json({ error: 'Automation failed', status, details: data });
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
        if (process.env.MIXPANEL_TOKEN) {
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

// Generate a referral code for an authenticated user
app.post('/api/generate-referral', async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const crypto = require('crypto');
    const code = crypto.randomBytes(4).toString('hex');
    if (!supabase) return res.status(500).json({ error: 'server misconfigured' });

    const { error } = await supabase.from('referrals').insert([{ code, owner_user_id: user.id, created_at: new Date().toISOString() }]);
    if (error) {
      console.warn('[generate-referral] db error', error.message || error);
      return res.status(500).json({ error: 'db error' });
    }
    const url = `${process.env.APP_PUBLIC_URL || 'http://localhost:3000'}/?ref=${code}`;
    return res.json({ ok: true, code, url });
  } catch (e) {
    console.error('[POST /api/generate-referral] error', e?.message || e);
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
    const { error } = await supabase.from('email_queue').insert([{ to_email, template, data: data || {}, scheduled_at: when, status: 'pending', created_at: new Date().toISOString() }]);
    if (error) {
      console.warn('[enqueue-email] db error', error.message || error);
      return res.status(500).json({ error: 'db error' });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[POST /api/enqueue-email] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Assign an experiment variant to the authenticated user and persist in profiles.experiment_assignments
app.post('/api/assign-experiment', async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { experiment_key, variants } = req.body || {};
    if (!experiment_key || !Array.isArray(variants) || variants.length === 0) return res.status(400).json({ error: 'experiment_key and variants[] required' });
    if (!supabase) return res.status(500).json({ error: 'server misconfigured' });

    // deterministic assignment by hashing user id
    const crypto = require('crypto');
    const h = crypto.createHash('sha1').update(user.id + '::' + experiment_key).digest('hex');
    const n = parseInt(h.slice(0,8), 16);
    const idx = n % variants.length;
    const variant = variants[idx];

    // merge into profiles.experiment_assignments JSONB
    try {
      const { data: profile } = await supabase.from('profiles').select('experiment_assignments').eq('id', user.id).maybeSingle();
      let assignments = (profile && profile.experiment_assignments) || {};
      assignments[experiment_key] = variant;
      await supabase.from('profiles').update({ experiment_assignments: assignments }).eq('id', user.id);
    } catch (e) {
      console.warn('[assign-experiment] profile update failed', e?.message || e);
    }

    // track assignment event
    try { await supabase.from('marketing_events').insert([{ user_id: user.id, event_name: 'experiment_assigned', properties: { experiment_key, variant }, created_at: new Date().toISOString() }]); } catch (e) { /* noop */ }

    return res.json({ ok: true, variant });
  } catch (e) {
    console.error('[POST /api/assign-experiment] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Trigger a small campaign sequence for the authenticated user (example: welcome series)
app.post('/api/trigger-campaign', async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { campaign, to_email } = req.body || {};
    if (!campaign) return res.status(400).json({ error: 'campaign is required' });

    // Determine target email: optional override via body (useful for admin/testing)
    let targetEmail = to_email || null;
    if (!targetEmail) {
      try {
        const { data: profile, error: pErr } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle();
        if (pErr) console.warn('[trigger-campaign] profile lookup error', pErr.message || pErr);
        targetEmail = profile && profile.email;
      } catch (e) {
        console.warn('[trigger-campaign] profile lookup failed', e?.message || e);
      }
    }

    if (!targetEmail) return res.status(400).json({ error: 'target email not found' });

    // Add contact to HubSpot in the background (fire-and-forget)
    if (process.env.HUBSPOT_API_KEY) {
      (async () => {
        try {
          const hubspotPayload = {
            properties: {
              email: targetEmail,
              // You can add more properties like firstname, lastname if you have them
              lifecyclestage: 'lead',
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
                const hubspotUpdatePayload = {
                  properties: {
                    lifecyclestage: 'lead',
                    // You could add other properties to update here, like:
                    // last_app_activity: new Date().toISOString()
                  },
                };

                await axios.patch(
                  `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
                  hubspotUpdatePayload,
                  { headers: { 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`, 'Content-Type': 'application/json' } }
                );
                console.log(`[trigger-campaign] Successfully updated contact ${targetEmail} in HubSpot.`);
              }
            } catch (updateError) {
              console.warn(`[trigger-campaign] Failed to update existing contact in HubSpot:`, updateError.response?.data || updateError.message);
            }
          } else {
            console.warn(`[trigger-campaign] Failed to add or update contact in HubSpot:`, hubspotError.response?.data || hubspotError.message);
          }
        }
      })();
    }

    const now = new Date();
    const inserts = [];

    // Small built-in campaign: welcome (immediate) + follow-up (3 days)
    if (campaign === 'welcome') {
      inserts.push({ to_email: targetEmail, template: 'welcome', data: { user_id: user.id }, scheduled_at: now.toISOString(), status: 'pending', created_at: new Date().toISOString() });
      const followup = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      inserts.push({ to_email: targetEmail, template: 'welcome_followup', data: { user_id: user.id }, scheduled_at: followup.toISOString(), status: 'pending', created_at: new Date().toISOString() });
    } else {
      return res.status(400).json({ error: 'unknown campaign' });
    }

    const { error } = await supabase.from('email_queue').insert(inserts);
    if (error) {
      console.error('[trigger-campaign] insert error', error.message || error);
      return res.status(500).json({ error: 'db error' });
    }

    return res.json({ ok: true, enqueued: inserts.length });
  } catch (e) {
    console.error('[trigger-campaign] fatal', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Admin scheduled endpoint: enqueue welcome emails for new profiles
// Protect with x-admin-secret header or ADMIN_API_SECRET env var
app.post('/admin/enqueue-welcome', express.json(), async (req, res) => {
  try {
    const secret = req.get('x-admin-secret') || process.env.ADMIN_API_SECRET;
    if (!secret || secret !== (req.get('x-admin-secret') || process.env.ADMIN_API_SECRET)) return res.status(401).json({ error: 'Unauthorized' });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return res.status(500).json({ error: 'server misconfigured' });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const days = parseInt(req.body?.days || '1', 10);
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();

    // Find profiles created since `since` and having an email
    const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('id,email,created_at').gte('created_at', since);
    if (pErr) {
      console.error('[admin/enqueue-welcome] profiles query failed', pErr.message || pErr);
      return res.status(500).json({ error: 'db error' });
    }

    let enqueued = 0;
    for (const p of profiles || []) {
      if (!p.email) continue;
      // check if a welcome template already scheduled or sent
      const { data: existing } = await supabaseAdmin.from('email_queue').select('id').eq('to_email', p.email).in('template', ['welcome','welcome_followup']).maybeSingle();
      if (existing) continue;
      const now = new Date().toISOString();
      const followup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const inserts = [
        { to_email: p.email, template: 'welcome', data: { user_id: p.id }, scheduled_at: now, status: 'pending', created_at: now },
        { to_email: p.email, template: 'welcome_followup', data: { user_id: p.id }, scheduled_at: followup, status: 'pending', created_at: now },
      ];
      const { error: insErr } = await supabaseAdmin.from('email_queue').insert(inserts);
      if (!insErr) enqueued += inserts.length;
    }

    return res.json({ ok: true, enqueued });
  } catch (e) {
    console.error('[admin/enqueue-welcome] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Admin: email queue stats for monitoring
app.get('/admin/email-queue-stats', async (req, res) => {
  try {
    const secret = req.get('x-admin-secret') || process.env.ADMIN_API_SECRET;
    if (!secret || secret !== (req.get('x-admin-secret') || process.env.ADMIN_API_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return res.status(500).json({ error: 'server misconfigured' });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Get counts by status (use head:true to fetch counts only)
    const pendingQ = await supabaseAdmin.from('email_queue').select('id', { head: true, count: 'exact' }).eq('status', 'pending');
    const sendingQ = await supabaseAdmin.from('email_queue').select('id', { head: true, count: 'exact' }).eq('status', 'sending');
    const sentQ = await supabaseAdmin.from('email_queue').select('id', { head: true, count: 'exact' }).eq('status', 'sent');
    const failedQ = await supabaseAdmin.from('email_queue').select('id', { head: true, count: 'exact' }).eq('status', 'failed');

    const pending = pendingQ.count || 0;
    const sending = sendingQ.count || 0;
    const sent = sentQ.count || 0;
    const failed = failedQ.count || 0;

    // oldest pending item for visibility
    const { data: oldest, error: oldErr } = await supabaseAdmin.from('email_queue').select('id,to_email,template,scheduled_at,created_at').eq('status', 'pending').order('scheduled_at', { ascending: true }).limit(1).maybeSingle();
    if (oldErr) console.warn('[email-queue-stats] oldest query failed', oldErr.message || oldErr);

    return res.json({ ok: true, counts: { pending, sending, sent, failed }, oldest_pending: oldest || null });
  } catch (e) {
    console.error('[admin/email-queue-stats] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// ----------------------------------------------------------------------------------

// Create a checkout session for a plan (authenticated users only)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { planId } = req.body || {};
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res.status(500).json({ error: 'Server not configured for payments (missing SUPABASE_SERVICE_ROLE)' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    // Look up plan metadata (expects a plans table with external_product_id)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (planErr) {
      console.error('[create-checkout-session] plan lookup error', planErr.message || planErr);
      return res.status(500).json({ error: 'Plan lookup failed' });
    }
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const POLAR_API_BASE = process.env.POLAR_API_BASE || process.env.POLAR_API_URL || 'https://api.polar.com';
    const POLAR_API_KEY = process.env.POLAR_API_KEY;
    if (!POLAR_API_KEY) return res.status(500).json({ error: 'Server not configured for Polar (missing POLAR_API_KEY)' });

    // Create hosted checkout session at Polar
    const crypto = require('crypto');
    // generate an external_payment_id server-side so we can track idempotency and tests
    const external_payment_id = (crypto.randomUUID && crypto.randomUUID()) || crypto.randomBytes(16).toString('hex');
    const payload = {
      product_id: plan.external_product_id || plan.external_product || plan.external_product_id,
      success_url: `${process.env.APP_PUBLIC_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_PUBLIC_URL || 'http://localhost:3000'}/billing/cancel`,
      metadata: { userId: user.id, planId, external_payment_id },
    };
    console.log('[create-checkout-session] generated external_payment_id', external_payment_id);

    const axiosResp = await axios.post(`${POLAR_API_BASE}/v1/checkout/sessions`, payload, {
      headers: {
        Authorization: `Bearer ${POLAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const session = axiosResp?.data || {};
    if (!session || (!session.url && !session.checkout_url)) {
      return res.status(502).json({ error: 'Invalid response from payment provider', detail: session });
    }

  // Return redirect URL and the generated external_payment_id to frontend
  res.json({ url: session.url || session.checkout_url, external_payment_id });
  } catch (err) {
    console.error('[create-checkout-session] error', err?.message || err);
    res.status(500).json({ error: 'failed to create checkout session', detail: err?.message || err });
  }
});

// Polar webhook endpoint - raw body required for signature verification
app.post('/polar-webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const sigHeader = req.get('polar-signature') || req.get('x-polar-signature') || '';
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    const payload = req.body; // Buffer

    // Verify HMAC-SHA256 signature if secret provided (Polar may use a different scheme - adapt if needed)
    if (webhookSecret) {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
      if (!sigHeader || sigHeader !== expected) {
        console.warn('[polar-webhook] signature mismatch');
        return res.status(400).send('invalid signature');
      }
    }

    let event = null;
    try {
      // Debug: log headers and a snippet of the raw payload to help diagnose parse errors
      console.log('[polar-webhook] incoming headers:', JSON.stringify(req.headers));
      const rawText = payload.toString();
      console.log('[polar-webhook] raw payload (first 2000 chars):', rawText.slice(0, 2000));
      event = JSON.parse(rawText);
    } catch (e) {
      console.warn('[polar-webhook] invalid json payload or parse error', (e && e.message) || e);
      return res.status(400).send('invalid payload');
    }

    // Example event: { type: 'checkout.session.completed', data: { id: 'pay_123', metadata: { userId, planId } } }
    if (event.type === 'checkout.session.completed' || event.type === 'payment.completed') {
      const data = event.data || {};
      const metadata = data.metadata || {};
      let userId = metadata.userId;
      const planId = metadata.planId;
      const externalPaymentId = data.id || data.payment_id || event.id;

      if (!userId || !planId || !externalPaymentId) {
        console.warn('[polar-webhook] missing metadata', { userId, planId, externalPaymentId });
        return res.status(400).send('missing metadata');
      }

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
        console.error('[polar-webhook] missing supabase configuration');
        return res.status(500).send('server misconfigured');
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

      // Resolve planId: accept either the internal UUID (plans.id), the external_product_id, or the plan name.
      let resolvedPlanId = null;
      try {
        // 1) Try direct ID match
        if (planId) {
          const { data: byId, error: byIdErr } = await supabaseAdmin.from('plans').select('id').eq('id', planId).maybeSingle();
          if (!byIdErr && byId && byId.id) resolvedPlanId = byId.id;
        }

        // 2) Try external_product_id
        if (!resolvedPlanId && planId) {
          const { data: byExternal, error: byExternalErr } = await supabaseAdmin.from('plans').select('id').eq('external_product_id', planId).maybeSingle();
          if (!byExternalErr && byExternal && byExternal.id) resolvedPlanId = byExternal.id;
        }

        // 3) Try by name
        if (!resolvedPlanId && planId) {
          const { data: byName, error: byNameErr } = await supabaseAdmin.from('plans').select('id').eq('name', planId).maybeSingle();
          if (!byNameErr && byName && byName.id) resolvedPlanId = byName.id;
        }
      } catch (e) {
        console.warn('[polar-webhook] plan lookup failed', e?.message || e);
      }

      // If still unresolved, fall back to original planId value (may be a UUID matching internal id)
      if (!resolvedPlanId) resolvedPlanId = planId;

      // Idempotency: check existing subscription by external_payment_id
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('external_payment_id', externalPaymentId)
        .maybeSingle();

      if (existing) {
        return res.status(200).send('already processed');
      }

      // Fetch plan row (to check feature_flags like requires_sales)
      let planRow = null;
      try {
        const { data: planData, error: planErr } = await supabaseAdmin.from('plans').select('*').eq('id', resolvedPlanId).maybeSingle();
        if (!planErr) planRow = planData;
      } catch (e) {
        console.warn('[polar-webhook] failed to fetch plan row', e?.message || e);
      }

      const requiresSales = !!(planRow && planRow.feature_flags && (planRow.feature_flags.requires_sales === true || planRow.feature_flags.requires_sales === 'true'));

      // Insert subscription record and update profile/roles
      const now = new Date().toISOString();
      const subscriptionStatus = requiresSales ? 'pending' : 'active';
      const startedAtValue = requiresSales ? null : now;

      const insertResp = await supabaseAdmin.from('subscriptions').insert([
        {
          user_id: userId,
          plan_id: resolvedPlanId,
          status: subscriptionStatus,
          started_at: startedAtValue,
          external_payment_id: externalPaymentId,
        },
      ]);

      if (insertResp.error) {
        console.error('[polar-webhook] insert subscription error', insertResp.error.message || insertResp.error);
        return res.status(500).send('db error');
      }

      // Update user profile with plan_id if a profiles table exists and the subscription is active
      if (!requiresSales) {
        try {
          await supabaseAdmin.from('profiles').update({ plan_id: resolvedPlanId }).eq('id', userId);
        } catch (e) {
          console.warn('[polar-webhook] failed to update profile', e.message || e);
        }
      } else {
        // For requires_sales plans we leave status pending and do not auto-assign the plan to the profile.
        console.log('[polar-webhook] subscription created as pending (requires sales approval)', { userId, planId: resolvedPlanId, externalPaymentId });
      }

      return res.status(200).send('ok');
    }

    // Unhandled event types
    res.status(200).send('ignored');
  } catch (err) {
    console.error('[polar-webhook] fatal', err?.message || err);
    res.status(500).send('internal error');
  }
});

// Admin endpoint to approve a pending subscription (simple secret auth)
// Body: { external_payment_id: string }
app.post('/admin/approve-subscription', express.json(), async (req, res) => {
  try {
    const secret = req.get('x-admin-secret') || process.env.ADMIN_API_SECRET;
    if (!secret || secret !== (req.get('x-admin-secret') || process.env.ADMIN_API_SECRET)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { external_payment_id } = req.body || {};
    if (!external_payment_id) return res.status(400).json({ error: 'external_payment_id required' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return res.status(500).json({ error: 'server misconfigured' });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Find subscription
    const { data: sub, error: subErr } = await supabaseAdmin.from('subscriptions').select('*').eq('external_payment_id', external_payment_id).maybeSingle();
    if (subErr) return res.status(500).json({ error: 'db error', detail: subErr.message || subErr });
    if (!sub) return res.status(404).json({ error: 'subscription not found' });

    // Activate
    const { error: updErr } = await supabaseAdmin.from('subscriptions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', sub.id);
    if (updErr) return res.status(500).json({ error: 'failed to update subscription', detail: updErr.message || updErr });

    // Upsert profile
    const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert([{ id: sub.user_id, plan_id: sub.plan_id, created_at: new Date().toISOString() }], { onConflict: 'id' });
    if (upsertErr) console.warn('[admin/approve] profile upsert failed', upsertErr.message || upsertErr);

    return res.json({ ok: true, subscription: sub });
  } catch (e) {
    console.error('[admin/approve] error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Fallback endpoints for frontend demo/fallback mode
app.get('/api/tasks', async (req, res) => {
  res.json([]);
});

app.get('/api/runs', async (req, res) => {
  res.json([]);
});

app.get('/api/dashboard', async (req, res) => {
  res.json({});
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Bind to 0.0.0.0 inside the container so the mapped host port is reachable.
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on http://0.0.0.0:${PORT}`));
