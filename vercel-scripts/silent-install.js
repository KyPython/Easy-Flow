#!/usr/bin/env node
// Silent npm install script for Vercel
// Completely suppresses all npm output to prevent Vercel from executing npm output lines

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine the target directory (rpa-system/rpa-dashboard or rpa-dashboard)
const rootDir = process.cwd();
const possibleDirs = [
  path.join(rootDir, 'rpa-system', 'rpa-dashboard'),
  path.join(rootDir, 'rpa-dashboard')
];

let targetDir = null;
for (const dir of possibleDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'package.json'))) {
    targetDir = dir;
    break;
  }
}

if (!targetDir) {
  console.error('❌ Error: rpa-dashboard directory not found');
  process.exit(1);
}

// Change to target directory
process.chdir(targetDir);

// Redirect all output to /dev/null to prevent Vercel from executing npm output
const devNull = process.platform === 'win32' ? 'nul' : '/dev/null';
const stdout = fs.openSync(devNull, 'w');
const stderr = fs.openSync(devNull, 'w');

// Run npm ci with all output suppressed
const npm = spawn('npm', ['ci', '--include=dev', '--silent', '--no-audit', '--no-fund', '--loglevel=silent'], {
  stdio: ['ignore', stdout, stderr],
  cwd: targetDir,
  shell: false
});

npm.on('close', (code) => {
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  
  if (code !== 0) {
    // If npm ci failed, try without --silent to see the error (but still suppress "added" lines)
    console.error('⚠️ npm ci failed, retrying...');
    const npm2 = spawn('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: targetDir,
      shell: false
    });
    
    let output = '';
    npm2.stdout.on('data', (data) => {
      const text = data.toString();
      // Filter out lines that start with "added", "removed", "changed" to prevent execution
      const filtered = text.split('\n').filter(line => 
        !line.trim().startsWith('added') && 
        !line.trim().startsWith('removed') && 
        !line.trim().startsWith('changed')
      ).join('\n');
      output += filtered;
    });
    
    npm2.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    npm2.on('close', (code2) => {
      if (code2 !== 0) {
        console.error('❌ npm ci failed:', output);
        process.exit(code2);
      }
      // Run patch-package if npm ci succeeded
      runPatchPackage();
    });
  } else {
    // Run patch-package if npm ci succeeded
    runPatchPackage();
  }
});

npm.on('error', (error) => {
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  console.error('❌ Error running npm ci:', error.message);
  process.exit(1);
});

function runPatchPackage() {
  // Re-open devNull for patch-package
  const patchStdout = fs.openSync(devNull, 'w');
  const patchStderr = fs.openSync(devNull, 'w');
  
  const patch = spawn('npx', ['patch-package', '--silent'], {
    stdio: ['ignore', patchStdout, patchStderr],
    cwd: targetDir,
    shell: false
  });
  
  patch.on('close', (code) => {
    fs.closeSync(patchStdout);
    fs.closeSync(patchStderr);
    // patch-package failures are non-fatal
    process.exit(0);
  });
  
  patch.on('error', () => {
    fs.closeSync(patchStdout);
    fs.closeSync(patchStderr);
    // patch-package failures are non-fatal
    process.exit(0);
  });
}

