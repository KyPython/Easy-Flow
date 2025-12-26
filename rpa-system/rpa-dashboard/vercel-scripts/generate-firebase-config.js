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

// Validate that required values are set
if (!config.apiKey || !config.projectId) {
  console.warn('⚠️  Warning: Firebase config is missing required values (apiKey, projectId)');
  console.warn('   Service worker may not function correctly without these values.');
}

