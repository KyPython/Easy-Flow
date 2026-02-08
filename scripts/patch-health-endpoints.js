#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'rpa-system', 'backend', 'app.js');
let content = fs.readFileSync(appPath, 'utf8');

// Enhanced /health/live endpoint
const liveOld = `app.get('/health/live', (_req, res) => {
   res.send('OK');
 });`;

const liveNew = `app.get('/health/live', (_req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime()
  });
 });`;

if (content.includes(liveOld)) {
  content = content.replace(liveOld, liveNew);
  console.log('✅ Enhanced /health/live endpoint');
} else {
  console.log('⚠️ /health/live endpoint pattern not found');
}

// Add uptime and memory to /health endpoint
const healthOld = `version: process.env.npm_package_version || '0.0.0',
    checks: {}`;

const healthNew = `version: process.env.npm_package_version || '0.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}`;

if (content.includes(healthOld)) {
  content = content.replace(healthOld, healthNew);
  console.log('✅ Added uptime and memory to /health endpoint');
} else {
  console.log('⚠️ /health endpoint pattern not found');
}

fs.writeFileSync(appPath, content);
console.log('✅ Patch applied successfully');
