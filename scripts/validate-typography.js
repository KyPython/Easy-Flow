#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const STRICT = process.env.STRICT_MODE === 'true';
const src = path.join(ROOT, 'rpa-system', 'rpa-dashboard', 'src');
let violations = 0;
function walk(dir){
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/i.test(e.name)){
      const t = fs.readFileSync(p, 'utf8');
      // naive heading hierarchy: warn if h3 appears and no h2 in the same file
      if (/<h3[\s>]/i.test(t) && !/<h2[\s>]/i.test(t)){
        console.log(`⚠️  Heading hierarchy: h3 without h2 in ${p}`);
        violations++;
      }
    }
  }
}
walk(src);
if (violations === 0) console.log('✅ Typography check passed');
process.exit(STRICT && violations > 0 ? 1 : 0);
