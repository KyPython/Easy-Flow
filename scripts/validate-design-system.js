#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const STRICT = process.env.STRICT_MODE === 'true';
const cfgPath = path.join(ROOT, '.design-system.json');
let fail = false;
if (!fs.existsSync(cfgPath)) {
  console.log('⚠️  .design-system.json not found');
  process.exit(STRICT ? 1 : 0);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const allowed = new Set(Object.values(cfg.colors).map(s => s.toLowerCase()));
const scanDir = path.join(ROOT, 'rpa-system', 'rpa-dashboard', 'src');
let findings = [];
function walk(dir){
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })){
    if (entry.name === 'node_modules' || entry.name === 'build') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/(\.jsx?|\.tsx?|\.css|\.scss|\.json)$/i.test(entry.name)){
      const txt = fs.readFileSync(p, 'utf8');
      const regex = /#(?:[0-9a-fA-F]{6})\b/g;
      let m;
      while ((m = regex.exec(txt))) {
        const hex = m[0].toLowerCase();
        if (!allowed.has(hex)) {
          findings.push({ file: p, color: hex, index: m.index });
        }
      }
    }
  }
}
walk(scanDir);
if (findings.length){
  console.log(`❌ Design tokens: found ${findings.length} non-approved color usages`);
  for (const f of findings.slice(0, 20)){
    console.log(`  ${f.file}:${f.index} -> ${f.color}`);
  }
  console.log(findings.length > 20 ? '  ...' : '');
  fail = true;
} else {
  console.log('✅ Design token check passed');
}
process.exit(fail && STRICT ? 1 : 0);
