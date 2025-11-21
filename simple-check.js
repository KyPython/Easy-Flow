#!/usr/bin/env node
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });

    await page.waitForTimeout(3000);

    const content = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasRoot: !!root,
        rootChildren: root ? root.children.length : 0,
        rootHTML: root ? root.innerHTML.substring(0, 200) : 'NO ROOT'
      };
    });

    console.log('\n=== PAGE CHECK ===');
    console.log('Has root:', content.hasRoot);
    console.log('Root children:', content.rootChildren);
    console.log('Root HTML preview:', content.rootHTML);
    console.log('Page errors:', errors.length);
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(' -', e));
    }

  } catch (e) {
    console.error('Failed to load page:', e.message);
  }

  await browser.close();
})();
