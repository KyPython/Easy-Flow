#!/usr/bin/env node
// Generate firebase-config.js from template and environment variables
// This script runs during the build process to create firebase-config.js for the service worker

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../public/firebase-config.js.template');
const outputPath = path.join(__dirname, '../public/firebase-config.js');

// Read template
let template = fs.readFileSync(templatePath, 'utf8');

// Get environment variables (from process.env or window._env in browser)
const env = process.env;

// Replace placeholders with environment variables
const config = {
  apiKey: env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: env.REACT_APP_FIREBASE_DATABASE_URL || '',
  projectId: env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.REACT_APP_FIREBASE_APP_ID || ''
};

// Replace template variables
template = template.replace(/\$\{REACT_APP_FIREBASE_API_KEY\}/g, config.apiKey);
template = template.replace(/\$\{REACT_APP_FIREBASE_AUTH_DOMAIN\}/g, config.authDomain);
template = template.replace(/\$\{REACT_APP_FIREBASE_DATABASE_URL\}/g, config.databaseURL);
template = template.replace(/\$\{REACT_APP_FIREBASE_PROJECT_ID\}/g, config.projectId);
template = template.replace(/\$\{REACT_APP_FIREBASE_STORAGE_BUCKET\}/g, config.storageBucket);
template = template.replace(/\$\{REACT_APP_FIREBASE_MESSAGING_SENDER_ID\}/g, config.messagingSenderId);
template = template.replace(/\$\{REACT_APP_FIREBASE_APP_ID\}/g, config.appId);

// Write output file
fs.writeFileSync(outputPath, template, 'utf8');

console.log('✓ Generated firebase-config.js');

// ✅ CRITICAL: Validate that required values are set
// Only fail in development when running `npm start` (not during builds or CI)
const isDevelopment = process.env.NODE_ENV !== 'production';
const isCI = process.env.CI === 'true' || process.env.VERCEL === 'true' || process.env.GITHUB_ACTIONS === 'true';
const isBuild = process.env.npm_lifecycle_event === 'build' || process.env.npm_lifecycle_event === 'prebuild';
const isStart = process.env.npm_lifecycle_event === 'start' || process.env.npm_lifecycle_event === 'prestart';

const missingRequired = [];

if (!config.apiKey || !config.apiKey.trim()) {
  missingRequired.push('REACT_APP_FIREBASE_API_KEY');
}
if (!config.projectId || !config.projectId.trim()) {
  missingRequired.push('REACT_APP_FIREBASE_PROJECT_ID');
}

if (missingRequired.length > 0) {
  const errorMessage = `\n\n🔥 FATAL: Firebase service worker configuration is missing required values!\n\n` +
    `Missing: ${missingRequired.join(', ')}\n\n` +
    `Impact: Service worker cannot initialize Firebase, causing uncaught errors.\n\n` +
    `Fix: Set these environment variables in .env.local (local) or Vercel (production):\n` +
    `  ${missingRequired.join('\n  ')}\n\n` +
    `For local development:\n` +
    `  1. Edit rpa-system/rpa-dashboard/.env.local\n` +
    `  2. Add the missing variables\n` +
    `  3. Restart the dev server (./stop-dev.sh && ./start-dev.sh)\n\n`;
  
  // ✅ DEVELOPMENT: Fail loudly when starting dev server (not during builds or CI)
  if (isDevelopment && isStart && !isCI) {
    console.error(errorMessage);
    console.error('Current config values:', {
      apiKey: config.apiKey ? '(present)' : '(missing)',
      projectId: config.projectId ? '(present)' : '(missing)',
      authDomain: config.authDomain ? '(present)' : '(missing)',
      appId: config.appId ? '(present)' : '(missing)'
    });
    process.exit(1); // Exit with error code to fail the start
  } else {
    // Build/CI: Warn but don't fail (to avoid breaking builds)
    console.warn('⚠️  Warning: Firebase config is missing required values:', missingRequired.join(', '));
    console.warn('   Service worker may not function correctly without these values.');
    if (isBuild && !isCI) {
      console.warn('   This is a build - consider setting these values before deploying.');
    }
  }
} else {
  console.log('✓ Firebase config validation passed');
}

