#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TARGET_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java'];
const EXCLUDED_DIRS = ['node_modules', 'dist', 'coverage'];

function scanDirectory(dirPath, foundDirs = new Set()) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let hasTargetFiles = false;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.includes(entry.name)) {
          scanDirectory(fullPath, foundDirs);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (TARGET_EXTENSIONS.includes(ext)) {
          hasTargetFiles = true;
        }
      }
    }

    if (hasTargetFiles) {
      foundDirs.add(dirPath);
    }
  } catch (err) {
    console.error(`Error scanning ${dirPath}: ${err.message}`);
  }

  return foundDirs;
}

const startPath = process.argv[2] || process.cwd();
const directories = scanDirectory(startPath);
const sorted = Array.from(directories).sort();

console.log(`Found ${sorted.length} directories with target files:\n`);
sorted.forEach(dir => console.log(dir));
