#!/usr/bin/env node
// Silent npm install script for Vercel
// Completely suppresses all output to prevent Vercel from executing npm output lines

const { spawn } = require('child_process');
const fs = require('fs');

// Redirect stdout and stderr to /dev/null using spawn (more reliable than execSync)
const devNull = process.platform === 'win32' ? 'nul' : '/dev/null';
const stdout = fs.openSync(devNull, 'w');
const stderr = fs.openSync(devNull, 'w');

// Use spawn instead of execSync for better control
const npm = spawn('npm', ['ci', '--include=dev', '--silent', '--no-audit', '--no-fund', '--loglevel=error'], {
 stdio: ['ignore', stdout, stderr],
 cwd: process.cwd(),
 shell: false
});

npm.on('close', (code) => {
 fs.closeSync(stdout);
 fs.closeSync(stderr);
 process.exit(code || 0);
});

npm.on('error', (error) => {
 fs.closeSync(stdout);
 fs.closeSync(stderr);
 process.exit(1);
});
