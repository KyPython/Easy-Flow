#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

function findLatestTraceDir(base) {
  const d = path.join(base, 'rpa-system', 'rpa-dashboard', 'diagnostics');
  if (!fs.existsSync(d)) return null;
  const children = fs.readdirSync(d).filter(n => n.endsWith('-freeze') || n.includes('freeze'));
  if (!children.length) return null;
  const full = children.map(name => ({ name, p: path.join(d, name), mtime: fs.statSync(path.join(d, name)).mtimeMs }));
  full.sort((a,b)=>b.mtime - a.mtime);
  return full[0].p;
}

function collectCallFrames(obj, collector, bundleName) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) return obj.forEach(o=>collectCallFrames(o,collector,bundleName));
  // Detect callFrame objects
  if (obj.callFrame && obj.callFrame.url && obj.callFrame.url.includes(bundleName)) {
    collector.push({ fn: obj.callFrame.functionName || '<anonymous>', line: obj.callFrame.lineNumber, col: obj.callFrame.columnNumber });
  }
  // CPU profile nodes structure
  if (obj.nodes && Array.isArray(obj.nodes)) {
    obj.nodes.forEach(n => {
      if (n.callFrame && n.callFrame.url && n.callFrame.url.includes(bundleName)) {
        collector.push({ fn: n.callFrame.functionName||'<anonymous>', line: n.callFrame.lineNumber, col: n.callFrame.columnNumber });
      }
    });
  }
  // Recurse
  Object.keys(obj).forEach(k => collectCallFrames(obj[k], collector, bundleName));
}

async function main() {
  const repoRoot = process.cwd();
  const traceArg = process.argv[2];
  let tracePath = traceArg;
  if (!tracePath) {
    const dir = findLatestTraceDir(repoRoot);
    if (!dir) {
      console.error('No trace provided and no diagnostics/*-freeze found');
      process.exit(1);
    }
    tracePath = path.join(dir, 'trace.json');
  }
  if (!fs.existsSync(tracePath)) { console.error('Trace not found:', tracePath); process.exit(2); }
  const trace = JSON.parse(fs.readFileSync(tracePath,'utf8'));

  // locate the main bundle filename under build/static/js
  const buildJsDir = path.join(repoRoot, 'rpa-system', 'rpa-dashboard', 'build', 'static', 'js');
  const files = fs.existsSync(buildJsDir) ? fs.readdirSync(buildJsDir) : [];
  const mainMap = files.find(f => f.endsWith('.js.map') && f.startsWith('main.'));
  if (!mainMap) { console.error('Could not find main.*.js.map in build/static/js'); process.exit(3); }
  const bundleName = mainMap.replace('.map','');
  const mapPath = path.join(buildJsDir, mainMap);
  console.log('Using trace:', tracePath);
  console.log('Using bundle:', bundleName, 'map:', mapPath);

  const collector = [];
  collectCallFrames(trace, collector, bundleName);
  if (!collector.length) {
    console.log('No call frames found referencing bundle in trace.');
    process.exit(0);
  }

  // Aggregate by location
  const byLoc = {};
  collector.forEach(c => {
    const key = `${c.line}:${c.col}:${c.fn}`;
    byLoc[key] = (byLoc[key]||0)+1;
  });

  const entries = Object.keys(byLoc).map(k => {
    const [line,col,fn] = k.split(':');
    return { line: parseInt(line,10), col: parseInt(col,10), fn, count: byLoc[k] };
  }).sort((a,b)=>b.count - a.count || (b.line - a.line));

  const rawMap = JSON.parse(fs.readFileSync(mapPath,'utf8'));
  // Support older source-map versions where SourceMapConsumer.with may not exist
  const possible = SourceMapConsumer(rawMap);
  const handleConsumer = (consumer) => {
    try {
      console.log('\nTop referenced bundle locations (mapped to original sources):\n');
      entries.slice(0,50).forEach((e,i)=>{
        // trace uses 0-based lines often; try both +0 and +1
        const guesses = [e.line+1, e.line];
        let orig = null;
        for (const g of guesses) {
          const pos = consumer.originalPositionFor({ line: g, column: e.col || 0 });
          if (pos && pos.source) { orig = pos; break; }
        }
        if (orig && orig.source) {
          console.log(`${i+1}. ${e.count} hits — ${orig.source}:${orig.line}:${orig.column} — name: ${orig.name || e.fn}`);
        } else {
          console.log(`${i+1}. ${e.count} hits — bundle@${e.line}:${e.col} — fn: ${e.fn}`);
        }
      });
    } finally {
      if (typeof consumer.destroy === 'function') consumer.destroy();
    }
  };

  if (possible && typeof possible.then === 'function') {
    possible.then(handleConsumer).catch(err=>{ console.error('Failed to consume source map promise:', err); process.exit(1); });
  } else {
    handleConsumer(possible);
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
