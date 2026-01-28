#!/usr/bin/env node
/**
 * Helper script to extract frontend API calls
 * Used by validate-ui-backend-parity.sh to avoid complex bash regex
 */

const fs = require('fs');
const path = require('path');

const frontendDir = process.argv[2] || 'rpa-system/rpa-dashboard/src';
const outputFile = process.argv[3] || '/tmp/frontend-api-calls.txt';

function extractApiCalls(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const calls = [];
  
  // Match api.get('/api/...'), api.post('/api/...'), etc.
  const apiCallRegex = /(?:api|axios)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = apiCallRegex.exec(content)) !== null) {
    const method = match[1];
    let apiPath = match[2];
    
    // Remove base URL if present
    apiPath = apiPath.replace(/^https?:\/\/[^/]+/, '');
    
    if (apiPath.startsWith('/api/')) {
      // Normalize path (UUIDs and numbers to {id})
      const normalized = apiPath
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
        .replace(/\/\d+/g, '/{id}');
      
      calls.push({ method, path: normalized });
    }
  }
  
  // Match fetch('/api/...') calls
  const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = fetchRegex.exec(content)) !== null) {
    let apiPath = match[1];
    
    // Remove base URL if present
    apiPath = apiPath.replace(/^https?:\/\/[^/]+/, '');
    
    if (apiPath.startsWith('/api/')) {
      // Normalize path
      const normalized = apiPath
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}')
        .replace(/\/\d+/g, '/{id}');
      
      calls.push({ method: 'get', path: normalized }); // Default to GET for fetch
    }
  }
  
  return calls;
}

// Removed - using recursive findFiles function instead

// Main execution
try {
  const output = [];
  
  if (!fs.existsSync(frontendDir)) {
    process.exit(0);
  }
  
  // Find all JS/JSX/TS/TSX files
  const files = [];
  function findFiles(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.includes('node_modules') && !entry.name.includes('.test') && !entry.name.includes('.spec')) {
            findFiles(fullPath);
          }
        } else if (entry.isFile()) {
          if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  findFiles(frontendDir);
  
  // Extract API calls from each file
  for (const file of files) {
    try {
      const calls = extractApiCalls(file);
      for (const call of calls) {
        output.push(`${call.method} ${call.path} ${file}`);
      }
    } catch (err) {
      // Skip files we can't read
    }
  }
  
  // Write to output file
  fs.writeFileSync(outputFile, output.join('\n') + '\n');
  
  console.log(output.length);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
