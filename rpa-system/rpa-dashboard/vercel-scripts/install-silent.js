#!/usr/bin/env node
// Silent npm install script for Vercel
// Completely suppresses all output to prevent Vercel from executing npm output lines

const { execSync } = require('child_process');
const fs = require('fs');

// Redirect stdout and stderr to /dev/null
const devNull = process.platform === 'win32' ? 'nul' : '/dev/null';
const stdout = fs.openSync(devNull, 'w');
const stderr = fs.openSync(devNull, 'w');

try {
  execSync('npm ci --include=dev --silent --no-audit --no-fund --loglevel=error', {
    stdio: ['ignore', stdout, stderr],
    cwd: process.cwd()
  });
  process.exit(0);
} catch (error) {
  process.exit(1);
}

