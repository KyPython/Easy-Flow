#!/usr/bin/env node
/**
 * Diagnose why the page won't load - capture ALL errors and network failures
 */

const puppeteer = require('puppeteer');

async function diagnosePage() {
  console.log('[Diagnose] Opening page...');

  const browser = await puppeteer.launch({
    headless: false, // Show the browser so we can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture ALL console messages
  const logs = [];
  page.on('console', msg => {
    const entry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    console.log(entry);
    logs.push(entry);
  });

  // Capture ALL errors
  const errors = [];
  page.on('pageerror', error => {
    const entry = `[PAGE ERROR] ${error.message}\n${error.stack}`;
    console.error(entry);
    errors.push(entry);
  });

  // Capture failed requests
  const failedRequests = [];
  page.on('requestfailed', request => {
    const entry = `[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`;
    console.error(entry);
    failedRequests.push(entry);
  });

  // Capture response errors
  page.on('response', response => {
    if (!response.ok()) {
      const entry = `[RESPONSE ERROR] ${response.url()} - ${response.status()} ${response.statusText()}`;
      console.error(entry);
      failedRequests.push(entry);
    }
  });

  try {
    console.log('[Diagnose] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('[Diagnose] Page loaded successfully!');

    // Check if React root rendered
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });

    console.log(`[Diagnose] React root has content: ${hasContent}`);

    // Wait a bit to see if anything else happens
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n===== SUMMARY =====');
    console.log(`Total console messages: ${logs.length}`);
    console.log(`Total page errors: ${errors.length}`);
    console.log(`Total failed requests: ${failedRequests.length}`);
    console.log(`React rendered: ${hasContent}`);

    if (errors.length > 0) {
      console.log('\n❌ PAGE ERRORS:');
      errors.forEach(e => console.log(e));
    }

    if (failedRequests.length > 0) {
      console.log('\n❌ FAILED REQUESTS:');
      failedRequests.forEach(r => console.log(r));
    }

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);

    // Take a screenshot
    await page.screenshot({ path: '/Users/ky/Desktop/Easy-Flow/diagnostics/page-stuck.png' });
    console.log('Screenshot saved to diagnostics/page-stuck.png');
  }

  // Don't close browser so user can inspect
  console.log('\n[Diagnose] Browser left open for inspection. Press Ctrl+C to close.');
}

diagnosePage().catch(console.error);
