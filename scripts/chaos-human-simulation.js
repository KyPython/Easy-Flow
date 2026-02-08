#!/usr/bin/env node
// chaos-human-simulation.js
// Simulates chaotic human behavior using Playwright

// Use @playwright/test dependency (installed in rpa-system) so CI/local gates
// don't rely on a separate root-level "playwright" dependency.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let errors = [];

  try {
    // 1. Go to landing page
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    // 2. Double-click random buttons
    const buttons = await page.$$('button');
    for (const btn of buttons.slice(0, 5)) {
      await btn.dblclick();
    }
    // 3. Refresh mid-action
    await page.click('button');
    await page.reload();
    // 4. Submit forms with weird data
    const inputs = await page.$$('input');
    for (const input of inputs) {
      await input.fill('!@#$%^&*()_+{}:"<>?');
    }
    await page.keyboard.press('Enter');
    // 5. Rapid navigation
    for (let i = 0; i < 3; i++) {
      await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(200);
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(200);
    }
    // 6. Multiple tabs
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page2.reload();
    await page2.close();
  } catch (e) {
    errors.push(e.message);
  }

  await browser.close();

  if (errors.length > 0) {
    console.error('❌ Chaos simulation errors:', errors);
    process.exit(1);
  } else {
    console.log('✅ Chaos simulation passed.');
    process.exit(0);
  }
})();
