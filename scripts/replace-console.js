#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'rpa-system', 'backend');
const LOGGER_REL = path.join('..', 'utils', 'logger'); // used to compute require path

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '.git'].includes(e.name)) continue;
      walk(full);
    } else if (e.isFile() && full.endsWith('.js')) {
      transformFile(full);
    }
  }
}

function transformFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!/console\.(log|warn|error|debug|info)\s*\(/.test(src)) return;

  const dir = path.dirname(filePath);
  // compute relative path from file to utils/logger.js
  const rel = path.relative(dir, path.resolve(ROOT, 'utils', 'logger.js')).replace(/\\/g, '/');
  let requirePath = rel;
  if (!requirePath.startsWith('.')) requirePath = './' + requirePath;
  // strip .js for require consistency
  requirePath = requirePath.replace(/\.js$/, '');

  // ensure logger require exists
  const requireRegex = /(?:const|let|var)\s+\{?\s*logger\s*\}?\s*=\s*require\(/;
  if (!requireRegex.test(src)) {
    // Insert after 'use strict' or first blank line after header comments
    let insertIdx = 0;
    const useStrictMatch = src.match(/(['\"])use strict\1;?/);
    if (useStrictMatch) {
      insertIdx = src.indexOf(useStrictMatch[0]) + useStrictMatch[0].length;
    } else {
      // after any leading comment block
      const shebang = src.startsWith('#!') ? src.indexOf('\n') + 1 : 0;
      insertIdx = shebang;
    }
    const requireLine = `\nconst { logger, getLogger } = require('${requirePath}');\n`;
    src = src.slice(0, insertIdx) + requireLine + src.slice(insertIdx);
  }

  // Replace console calls: handle console.error(...), console.warn(...), console.log(...), console.debug(...), console.info(...)
  // Replace patterns preserving argument lists
  src = src.replace(/console\.error\s*\(/g, 'logger.error(');
  src = src.replace(/console\.warn\s*\(/g, 'logger.warn(');
  src = src.replace(/console\.log\s*\(/g, 'logger.info(');
  src = src.replace(/console\.debug\s*\(/g, 'logger.debug(');
  src = src.replace(/console\.info\s*\(/g, 'logger.info(');

  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`Patched: ${path.relative(ROOT, filePath)}`);
}

if (require.main === module) {
  console.log('Starting console -> structured logger replacement under:', ROOT);
  walk(ROOT);
  console.log('Replacement complete.');
}
