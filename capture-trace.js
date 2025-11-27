#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

(async () => {
  const outDir = path.join(process.cwd(), 'diagnostics', `${timestamp()}-freeze`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[capture-trace] launching browser...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Inject a listener so any in-page devNetLogger events get emitted to the console
  try {
    await page.evaluateOnNewDocument(() => {
      try {
        window.addEventListener('devNetLogger:corsCookieWarning', (e) => {
          try {
            // Ensure this appears as a console warning which Puppeteer captures
            console.warn('CORS_COOKIE_WARNING', JSON.stringify(e && e.detail));
          } catch (err) {}
        });
      } catch (err) {}
    });
  } catch (e) {
    // Non-fatal if evaluateOnNewDocument isn't available
  }

  const consoleEntries = [];
  const corsWarnings = [];
  page.on('console', (msg) => {
    try {
      const text = msg.text();
      const entry = { type: msg.type(), text, timestamp: new Date().toISOString() };
      consoleEntries.push(entry);
      // Detect our injected CORS cookie warnings and store them separately
      try {
        if (msg.type() === 'warning' && typeof text === 'string' && text.indexOf('CORS_COOKIE_WARNING') !== -1) {
          // Extract JSON payload if present
          const parts = text.split('CORS_COOKIE_WARNING');
          const payload = parts.length > 1 ? parts.slice(1).join('CORS_COOKIE_WARNING').trim() : null;
          let detail = null;
          try { detail = payload ? JSON.parse(payload) : { raw: text }; } catch (e) { detail = { raw: text }; }
          corsWarnings.push({ timestamp: new Date().toISOString(), detail });
        }
      } catch (e) {}
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
    } catch (e) {}
  });

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack, timestamp: new Date().toISOString() });
    console.error('[PAGE ERROR]', err.message);
  });

  try {
    const tracePath = path.join(outDir, 'trace.json');
    console.log('[capture-trace] starting tracing...');

    await page.tracing.start({ path: tracePath, screenshots: false });

    const targetUrl = process.argv[2] || process.env.CAPTURE_URL || 'http://localhost:3000';
    console.log('[capture-trace] navigating to', targetUrl);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => console.warn('[capture-trace] goto warning', e && e.message));

    // Wait a small amount to let app hydrate and for long tasks to appear
    const RECORD_MS = 10000;
    console.log(`[capture-trace] recording for ${RECORD_MS}ms...`);
    // Some Puppeteer builds may not expose page.waitForTimeout; use a Promise sleep instead
    await new Promise((res) => setTimeout(res, RECORD_MS));

    console.log('[capture-trace] stopping tracing...');
    await page.tracing.stop();

    // Save console and errors
    fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify({ console: consoleEntries, pageErrors }, null, 2));

    // Persist any CORS cookie warnings discovered during the run
    try {
      if (corsWarnings.length > 0) {
        const corsJsonPath = path.join(outDir, 'cors-cookie-warnings.json');
        fs.writeFileSync(corsJsonPath, JSON.stringify(corsWarnings, null, 2));
        const corsLogPath = path.join(outDir, 'cors-cookie-warnings.log');
        const lines = corsWarnings.map(w => `[${w.timestamp}] ${JSON.stringify(w.detail)}`);
        fs.appendFileSync(corsLogPath, lines.join('\n') + '\n');
        console.log('[capture-trace] wrote CORS cookie warnings to', corsJsonPath, 'and', corsLogPath);
      }
    } catch (e) {
      console.warn('[capture-trace] failed to persist CORS cookie warnings', e && e.message);
    }

    // Capture a simple page snapshot (dom preview)
    const snapshot = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        title: document.title,
        url: location.href,
        hasRoot: !!root,
        rootChildren: root ? root.children.length : 0,
        htmlPreview: root ? root.innerHTML.substring(0, 2000) : null
      };
    });
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ snapshot, timestamp: new Date().toISOString() }, null, 2));

    console.log('[capture-trace] saved trace to', tracePath);
    console.log('[capture-trace] saved console.json and report.json to', outDir);

  } catch (e) {
    console.error('[capture-trace] failed:', e && e.message ? e.message : e);
  } finally {
    try { await browser.close(); } catch (e) {}
  }

  console.log('[capture-trace] done.');
})();
