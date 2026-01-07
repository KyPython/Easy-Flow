#!/usr/bin/env node
/**
 * Automated code quality fixes:
 * - Replace console.log/info/warn/error/debug with structured logger
 * - Add logger imports where needed
 * - Replace hardcoded messages with getEnvMessage() (basic cases)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../rpa-system/rpa-dashboard/src');

// Find all JS/JSX files
function findFiles(dir, extensions = ['.js', '.jsx']) {
 const files = [];
 function walk(currentPath) {
 const entries = fs.readdirSync(currentPath, { withFileTypes: true });
 for (const entry of entries) {
 const fullPath = path.join(currentPath, entry.name);
 if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
 walk(fullPath);
 } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
 files.push(fullPath);
 }
 }
 }
 walk(dir);
 return files;
}

// Replace console calls with logger calls
function fixConsoleCalls(content, filePath) {
 let modified = content;
 const relativePath = path.relative(process.cwd(), filePath);
 const needsLogger = /console\.(log|info|warn|error|debug)/.test(content);
 
 if (!needsLogger) return { modified, needsLogger: false };
 
 // Check if logger is already imported
 const hasLoggerImport = /import.*createLogger.*from.*['"]\.\.?\/.*logger['"]/.test(content) ||
 /import.*logger.*from.*['"]\.\.?\/.*logger['"]/.test(content) ||
 /const.*createLogger.*require/.test(content);
 
 // Extract namespace from file path
 const namespace = path.basename(filePath, path.extname(filePath));
 
 // Replace console methods
 modified = modified.replace(/console\.debug\((.*?)\)/g, (match, args) => {
 return `logger.debug(${args})`;
 });
 
 modified = modified.replace(/console\.log\((.*?)\)/g, (match, args) => {
 // Try to detect if it's an error log or info log
 if (args.includes('error') || args.includes('Error') || args.includes('failed')) {
 return `logger.error(${args})`;
 }
 return `logger.info(${args})`;
 });
 
 modified = modified.replace(/console\.info\((.*?)\)/g, (match, args) => {
 return `logger.info(${args})`;
 });
 
 modified = modified.replace(/console\.warn\((.*?)\)/g, (match, args) => {
 return `logger.warn(${args})`;
 });
 
 modified = modified.replace(/console\.error\((.*?)\)/g, (match, args) => {
 return `logger.error(${args})`;
 });
 
 // Add logger import if needed
 if (!hasLoggerImport && modified !== content) {
 // Find the last import statement
 const importRegex = /^(import\s+.*?from\s+['"].*?['"];?\s*)$/gm;
 const imports = content.match(importRegex) || [];
 const lastImportIndex = content.lastIndexOf(imports[imports.length - 1] || '');
 
 if (lastImportIndex !== -1) {
 const lastImportEnd = content.indexOf('\n', lastImportIndex);
 const insertPosition = lastImportEnd !== -1 ? lastImportEnd + 1 : lastImportIndex;
 
 // Calculate relative path to logger
 const fileDir = path.dirname(filePath);
 const loggerPath = path.relative(fileDir, path.join(SRC_DIR, 'utils/logger'));
 const relativeImport = loggerPath.replace(/\\/g, '/').replace(/^\.\.\//, '../').replace(/^[^.]/, './');
 
 modified = modified.slice(0, insertPosition) +
 `import { createLogger } from '${relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`}';\n` +
 `const logger = createLogger('${namespace}');\n` +
 modified.slice(insertPosition);
 }
 }
 
 return { modified, needsLogger: true, addedImport: !hasLoggerImport && modified !== content };
}

// Process files
const files = findFiles(SRC_DIR);
let fixed = 0;
let skipped = 0;

console.log(`Found ${files.length} files to process...\n`);

for (const file of files) {
 try {
 const content = fs.readFileSync(file, 'utf8');
 const result = fixConsoleCalls(content, file);
 
 if (result.modified !== content) {
 fs.writeFileSync(file, result.modified, 'utf8');
 fixed++;
 console.log(`✓ Fixed: ${path.relative(process.cwd(), file)}`);
 } else {
 skipped++;
 }
 } catch (error) {
 console.error(`✗ Error processing ${file}:`, error.message);
 }
}

console.log(`\n✅ Fixed ${fixed} files, skipped ${skipped} files`);

