#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findLatestTraceDir() {
  const d = path.join(process.cwd(), 'diagnostics');
  if (!fs.existsSync(d)) return null;
  const children = fs.readdirSync(d).filter(n => n.endsWith('-freeze') || n.includes('freeze'));
  if (children.length === 0) return null;
  // sort by mtime
  const full = children.map(name => ({ name, p: path.join(d, name), mtime: fs.statSync(path.join(d, name)).mtimeMs }));
  full.sort((a,b) => b.mtime - a.mtime);
  return full[0].p;
}

function readTrace(tracePath) {
  const raw = fs.readFileSync(tracePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse trace JSON:', err.message);
    process.exit(2);
  }
}

function extractEvents(traceJson) {
  // puppeteer/Chrome trace format may be {traceEvents: [...]} or an array
  if (Array.isArray(traceJson)) return traceJson;
  if (traceJson.traceEvents) return traceJson.traceEvents;
  // Try common key
  for (const k of Object.keys(traceJson)) {
    if (Array.isArray(traceJson[k])) return traceJson[k];
  }
  return [];
}

function summarize(events, topN = 20) {
  const candidates = events
    .filter(e => e && e.name && (/(EvaluateScript|RunTask|FunctionCall|ParseHTML|CompileScript|v8\.|V8\.Execute|Task)/i.test(e.name) || (e.cat && /devtools.timeline/i.test(e.cat))))
    .map(e => {
      const dur = typeof e.dur === 'number' ? e.dur / 1000 : null; // convert us -> ms if present
      const ts = e.ts || null;
      const url = (e.args && e.args.data && (e.args.data.url || e.args.data.scriptId)) || (e.args && e.args['url']) || (e.args && e.args['src']) || null;
      // try stack
      let topFrame = null;
      if (e.args && e.args.stackTrace && e.args.stackTrace.length) {
        const st = e.args.stackTrace[0];
        if (st.callFrames && st.callFrames.length) {
          const cf = st.callFrames[0];
          topFrame = `${cf.url || cf.scriptId || cf.functionName}:${cf.lineNumber || cf.line || '?'}:${cf.columnNumber || cf.column || '?'} `;
        }
      }
      // sometimes stack is in e.args.data.stack
      if (!topFrame && e.args && e.args.data && e.args.data.stack) {
        topFrame = String(e.args.data.stack).split('\n')[0];
      }
      return { name: e.name, durMs: dur, ts, url, topFrame };
    })
    .filter(x => x.durMs !== null && x.durMs !== undefined)
    .sort((a,b) => b.durMs - a.durMs)
    .slice(0, topN);

  return candidates;
}

(async function main(){
  const arg = process.argv[2];
  let tracePath = arg;
  if (!tracePath) {
    const dir = findLatestTraceDir();
    if (!dir) {
      console.error('No diagnostics/*-freeze/ directory found. Provide path to trace.json as first arg.');
      process.exit(1);
    }
    tracePath = path.join(dir, 'trace.json');
  }
  if (!fs.existsSync(tracePath)) {
    console.error('Trace file not found at', tracePath);
    process.exit(2);
  }
  console.log('Reading trace:', tracePath);
  const trace = readTrace(tracePath);
  const events = extractEvents(trace);
  console.log('Total trace events:', events.length);
  const top = summarize(events, 30);
  const out = { tracePath, totalEvents: events.length, topEvents: top };
  const outPath = path.join(path.dirname(tracePath), 'trace-summary.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('\nTop long events (written to', outPath, '):\n');
  top.forEach((t,i) => {
    console.log(`${i+1}. ${t.name} — ${t.durMs.toFixed(1)} ms${t.url ? ' — ' + t.url : ''}${t.topFrame ? ' — frame: ' + t.topFrame : ''}`);
  });
})();
