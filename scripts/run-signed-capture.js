#!/usr/bin/env node
// Launch Puppeteer, inject a Supabase session into localStorage, and capture console/trace.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function readBackendEnv() {
  const p = path.join(__dirname, '..', 'rpa-system', 'backend', '.env');
  try {
    const text = fs.readFileSync(p, 'utf8');
    const lines = text.split(/\r?\n/);
    const out = {};
    for (const l of lines) {
      const m = l.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    return out;
  } catch (e) {
    return {};
  }
}
function readFrontendEnv() {
  const p = path.join(__dirname, '..', 'rpa-system', 'rpa-dashboard', '.env.local');
  try {
    const text = fs.readFileSync(p, 'utf8');
    const lines = text.split(/\r?\n/);
    const out = {};
    for (const l of lines) {
      const m = l.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    return out;
  } catch (e) {
    return {};
  }
}

async function main() {
  const env = readFrontendEnv();
  const backendEnv = readBackendEnv();

  // If caller provided --token, use that. Otherwise programmatically create & sign-in a test user
  let token = null;
  if (process.argv.includes('--token')) token = process.argv[process.argv.indexOf('--token') + 1];

  const SUPABASE_URL = process.env.SUPABASE_URL || backendEnv.SUPABASE_URL || env.SUPABASE_URL || '';
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || backendEnv.SUPABASE_SERVICE_ROLE || '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || backendEnv.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  if (!token) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !SUPABASE_ANON_KEY) {
      console.error('No token provided and Supabase config missing. Provide --token or ensure backend .env has SUPABASE_URL, SUPABASE_SERVICE_ROLE and SUPABASE_ANON_KEY');
      process.exit(2);
    }

    // Programmatic flow: create a temporary user (idempotent) and sign in to obtain a valid access token
    const crypto = require('crypto');
    const random = () => crypto.randomBytes(6).toString('hex');
    const testEmail = `diagnostic+${Date.now()}@example.com`;
    const testPassword = `P@ssw0rd-${random()}`;

    async function createUser() {
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
            apikey: SUPABASE_SERVICE_ROLE
          },
          body: JSON.stringify({ email: testEmail, password: testPassword, email_confirm: true })
        });
        if (res.status === 201) {
          return true;
        }
        // 409 or other -> continue (user may already exist)
        const txt = await res.text();
        console.warn('[signed-capture] createUser unexpected status', res.status, txt.slice(0, 200));
        return res.status === 409;
      } catch (e) {
        console.warn('[signed-capture] createUser failed', e && e.message);
        return false;
      }
    }

    async function signIn() {
      const tokenUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
      try {
        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ email: testEmail, password: testPassword })
        });
        const json = await res.json().catch(()=>null) || {};
        if (res.status === 200 && json.access_token) {
          return { access_token: json.access_token, refresh_token: json.refresh_token, user: json.user || null, expires_in: json.expires_in };
        }
        console.warn('[signed-capture] signIn failed', res.status, JSON.stringify(json).slice(0,200));
        return null;
      } catch (e) {
        console.warn('[signed-capture] signIn error', e && e.message);
        return null;
      }
    }

    // create user and sign in
    (async () => {
      await createUser();
      const session = await signIn();
      if (session && session.access_token) {
        token = session.access_token;
        // also write a small session-like object for the page hydration
        env._programmatic_session = JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || { id: 'diag-user' }, expires_in: session.expires_in || 3600 });
      } else {
        console.error('[signed-capture] Failed to obtain a valid Supabase access_token programmatically');
      }
    })();

    // Wait up to 6s for the programmatic sign-in to complete (simple synchronisation)
    const start = Date.now();
    while (!token && Date.now() - start < 6000) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 200));
    }
    if (!token) {
      console.error('Unable to obtain token programmatically');
      process.exit(3);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'diagnostics', `${timestamp}-signed-capture`);
  fs.mkdirSync(outDir, { recursive: true });

  // Persist the raw token used so we can validate it after the run
  try {
    fs.writeFileSync(path.join(outDir, 'token.txt'), token || '', { encoding: 'utf8' });
  } catch (e) {
    // non-fatal
  }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const consoleEntries = [];
  page.on('console', msg => {
    try { consoleEntries.push({ type: msg.type(), text: msg.text(), args: msg.args().map(a=>String(a)) }); } catch(e){}
  });
  page.on('pageerror', err => consoleEntries.push({ type: 'pageerror', text: err.message, stack: err.stack }));

  // Before navigating, set up localStorage with a Supabase session
  await page.goto('about:blank');
  const session = {
    provider_token: null,
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: token,
    user: { id: 'local-debug-user' }
  };

  await page.evaluateOnNewDocument((key, sess) => {
    try {
      // Primary supabase session object used by the SDK
      localStorage.setItem('sb-auth-token', JSON.stringify(sess));
      // Some code paths expect a similarly named key
      localStorage.setItem('supabase-auth-token', JSON.stringify(sess));
      localStorage.setItem('supabase.session', JSON.stringify(sess));

      // Also write raw access token values for any helpers that look for simple keys
      const raw = sess.access_token || '';
      try { localStorage.setItem('dev_token', raw); } catch (_) {}
      try { localStorage.setItem('authToken', raw); } catch (_) {}
      try { localStorage.setItem('token', raw); } catch (_) {}
      try { localStorage.setItem('sb_access_token', raw); } catch (_) {}

      console.log('[signed-capture] injected localStorage key sb-auth-token and fallback keys');
    } catch (e) {
      console.error('[signed-capture] failed to inject session', e && e.message);
    }
  }, 'sb-auth-token', session);

  try {
    const target = process.env.TARGET_URL || 'http://localhost:3000';
    // Increase navigation timeout to accommodate slow dev builds
    await page.goto(target, { waitUntil: 'networkidle2', timeout: 60000 });
    // wait a bit for app init and realtime subscriptions
    await new Promise(res => setTimeout(res, 8000));
    // Ensure storage keys are present after any app startup that may clear them
    try {
      await page.evaluate((sess) => {
        try {
          localStorage.setItem('sb-auth-token', JSON.stringify(sess));
          localStorage.setItem('supabase-auth-token', JSON.stringify(sess));
          localStorage.setItem('supabase.session', JSON.stringify(sess));
          const raw = sess.access_token || '';
          localStorage.setItem('dev_token', raw);
          localStorage.setItem('authToken', raw);
          localStorage.setItem('token', raw);
          localStorage.setItem('sb_access_token', raw);
          return (localStorage.getItem('sb-auth-token') || '').length;
        } catch (e) {
          return `err:${e && e.message}`;
        }
      }, session);
      const post = await page.evaluate(() => (localStorage.getItem('sb-auth-token') || '').length);
      console.log('[signed-capture] post-nav sb-auth-token length (after re-inject):', post);
    } catch (e) {
      console.warn('[signed-capture] failed to re-inject session after nav', e && e.message);
    }
    // Attempt to hydrate the Supabase client session from localStorage
    try {
      await page.evaluate(async () => {
        try {
          const start = Date.now();
          // Wait for the client to be available
          while (!(window._supabase && window._supabase.auth && typeof window._supabase.auth.setSession === 'function') && (Date.now() - start) < 10000) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, 200));
          }
          const raw = localStorage.getItem('sb-auth-token');
          if (!raw) {
            console.log('[signed-capture] no sb-auth-token present to hydrate');
            return;
          }
          const sess = JSON.parse(raw);
          if (window._supabase && window._supabase.auth && typeof window._supabase.auth.setSession === 'function') {
            await window._supabase.auth.setSession(sess);
            console.log('[signed-capture] hydrated supabase client session via setSession (from localStorage)');
          } else {
            console.log('[signed-capture] supabase client not available for setSession');
          }
        } catch (e) {
          console.error('[signed-capture] in-page setSession failed', e && e.message);
        }
      });
      // Give app a moment to process auth state changes
      await new Promise(res => setTimeout(res, 1500));
    } catch (e) {
      // non-fatal
    }

    // As a last resort, directly set the realtime auth token on the client
    try {
      await page.evaluate(() => {
        try {
          const raw = localStorage.getItem('sb-auth-token');
          if (!raw) return console.log('[signed-capture] no sb-auth-token present for realtime.setAuth');
          const sess = JSON.parse(raw);
          if (window._supabase && window._supabase.realtime && typeof window._supabase.realtime.setAuth === 'function') {
            window._supabase.realtime.setAuth(sess.access_token);
            console.log('[signed-capture] setRealtimeAuth called');
          } else {
            console.log('[signed-capture] realtime client not available for setAuth');
          }
        } catch (e) {
          console.error('[signed-capture] realtime.setAuth failed', e && e.message);
        }
      });
      await new Promise(res => setTimeout(res, 500));
    } catch (e) {
      // ignore
    }
  } catch (e) {
    console.error('[signed-capture] navigation error:', e.message || e);
  }

  // Dump console entries and save a minimal trace (console + network requests not collected here)
  fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(consoleEntries, null, 2));
  console.log('[signed-capture] wrote console.json to', outDir);

  await browser.close();
}

main().catch(e=>{ console.error(e); process.exit(1); });
