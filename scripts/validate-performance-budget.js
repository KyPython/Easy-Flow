#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const STRICT = process.env.STRICT_MODE === 'true';
const backend = path.join(ROOT, 'rpa-system', 'backend');
let notes = 0;
function scanFile(p){
  const t = fs.readFileSync(p, 'utf8');
  // naive hints
  if (/SELECT\s+\*\s+FROM\s+\w+\s*;?/i.test(t) && !/limit\s+\d+/i.test(t)){
    console.log(`⚠️  Query without LIMIT in ${p}`);
    notes++;
  }
}
function walk(dir){
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|sql)$/i.test(e.name)) scanFile(p);
  }
}
walk(backend);
if (notes === 0) console.log('✅ Performance budget check passed');
process.exit(STRICT && notes > 0 ? 1 : 0);
