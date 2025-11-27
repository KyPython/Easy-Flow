#!/usr/bin/env node
/**
 * Headless test to validate frontend runtime responsiveness
 * Captures Performance trace, HAR, and console logs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const WAIT_TIME_MS = parseInt(process.env.WAIT_TIME_MS) || 8000;

async function testRuntimeResponsiveness() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'diagnostics', `${timestamp}-freeze`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Test] Starting headless test for ${TARGET_URL}`);
  console.log(`[Test] Output directory: ${outputDir}`);

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Collect errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Start performance tracing
    console.log('[Test] Starting performance trace...');
    await page.tracing.start({
      path: path.join(outputDir, 'trace.json'),
      screenshots: true,
      categories: ['devtools.timeline', 'blink.user_timing']
    });

    // Navigate to the page
    console.log('[Test] Navigating to page...');
    const startTime = Date.now();

    await page.goto(TARGET_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    const loadTime = Date.now() - startTime;
    console.log(`[Test] Page loaded in ${loadTime}ms`);

    // Wait for specified time to capture any lazy-loaded content
    console.log(`[Test] Waiting ${WAIT_TIME_MS}ms for app to initialize...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_TIME_MS));

    // Stop tracing
    console.log('[Test] Stopping performance trace...');
    await page.tracing.stop();

    // Capture performance metrics
    console.log('[Test] Collecting performance metrics...');
    const metrics = await page.metrics();
    const performanceMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const longTasks = performance.getEntriesByType('longtask') || [];

      return {
        navigation: nav ? {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
          loadComplete: nav.loadEventEnd - nav.fetchStart,
          domInteractive: nav.domInteractive - nav.fetchStart,
          responseEnd: nav.responseEnd - nav.fetchStart
        } : null,
        paint: paint.map(p => ({ name: p.name, startTime: p.startTime })),
        longTasks: longTasks.map(t => ({
          name: t.name,
          startTime: t.startTime,
          duration: t.duration,
          attribution: t.attribution ? t.attribution.map(a => ({
            name: a.name,
            containerType: a.containerType,
            containerName: a.containerName
          })) : []
        })),
        memory: performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });

    // Check if page is responsive
    console.log('[Test] Testing page interactivity...');
    const isResponsive = await page.evaluate(() => {
      // Try to check if main thread is responsive
      const start = performance.now();
      let iterations = 0;
      while (performance.now() - start < 100) {
        iterations++;
      }
      return iterations > 1000; // Should be able to do many iterations if responsive
    });

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      targetUrl: TARGET_URL,
      testDuration: WAIT_TIME_MS,
      loadTime,
      isResponsive,
      metrics,
      performanceMetrics,
      consoleMessages,
      errors,
      longTasksFound: performanceMetrics.longTasks?.length || 0,
      analysis: {
        hasBlockingLongTasks: (performanceMetrics.longTasks || []).some(t => t.duration > 200),
        blockingTasks: (performanceMetrics.longTasks || []).filter(t => t.duration > 200),
        totalConsoleErrors: consoleMessages.filter(m => m.type === 'error').length,
        totalPageErrors: errors.length
      }
    };

    // Save report
    const reportPath = path.join(outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[Test] Report saved to: ${reportPath}`);

    // Save console logs
    const consolePath = path.join(outputDir, 'console.json');
    fs.writeFileSync(consolePath, JSON.stringify(consoleMessages, null, 2));
    console.log(`[Test] Console logs saved to: ${consolePath}`);

    // Save errors
    if (errors.length > 0) {
      const errorsPath = path.join(outputDir, 'errors.json');
      fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));
      console.log(`[Test] Errors saved to: ${errorsPath}`);
    }

    // Generate summary
    console.log('\n===== TEST SUMMARY =====');
    console.log(`Load Time: ${loadTime}ms`);
    console.log(`Responsive: ${isResponsive ? 'YES' : 'NO'}`);
    console.log(`Long Tasks (>50ms): ${report.longTasksFound}`);
    console.log(`Blocking Tasks (>200ms): ${report.analysis.blockingTasks.length}`);
    console.log(`Console Errors: ${report.analysis.totalConsoleErrors}`);
    console.log(`Page Errors: ${report.analysis.totalPageErrors}`);

    if (report.analysis.blockingTasks.length > 0) {
      console.log('\n⚠️  BLOCKING TASKS DETECTED:');
      report.analysis.blockingTasks.forEach(task => {
        console.log(`  - Duration: ${task.duration.toFixed(2)}ms at ${task.startTime.toFixed(2)}ms`);
      });
    }

    console.log(`\nAll artifacts saved to: ${outputDir}`);
    console.log('========================\n');

    await browser.close();

    // Exit with non-zero if blocking tasks detected or not responsive
    if (!isResponsive || report.analysis.blockingTasks.length > 0) {
      console.error('❌ Test FAILED: App is not responsive or has blocking tasks');
      process.exit(1);
    } else {
      console.log('✅ Test PASSED: App is responsive with no blocking tasks');
      process.exit(0);
    }

  } catch (error) {
    console.error('[Test] ERROR:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

testRuntimeResponsiveness();
