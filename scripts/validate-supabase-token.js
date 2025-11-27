#!/usr/bin/env node
/*
 * Validate a Supabase JWT by calling the Supabase auth user endpoint.
 * Usage: node scripts/validate-supabase-token.js --token <JWT>
 * If SUPABASE_URL and SUPABASE_SERVICE_ROLE are available in
 * `rpa-system/backend/.env` they will be used; otherwise set env vars.
 */

const fs = require('fs');
const path = require('path');

function readBackendEnv() {
  const p = path.join(__dirname, '..', 'rpa-system', 'backend', '.env');
  try {
    const text = fs.readFileSync(p, 'utf8');
    const lines = text.split(/\r?\n/);
    const out = {};
    for (const l of lines) {
      const m = l.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
    }
    return out;
  } catch (e) {
    return {};
  }
}

async function main() {
  const argv = process.argv.slice(2);
  let token = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--token' || argv[i] === '-t') token = argv[i + 1];
  }

  if (!token) {
    // Try to read from STDIN
    const stat = fs.fstatSync(0);
    if (stat.isFIFO() || stat.isFile()) {
      token = fs.readFileSync(0, 'utf8').trim();
    }
  }

  if (!token) {
    console.error('Usage: node scripts/validate-supabase-token.js --token <JWT>');
    process.exit(2);
  }

  const env = readBackendEnv();
  const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE || '';

  if (!SUPABASE_URL) {
    console.error('Supabase URL not found. Set SUPABASE_URL env or provide rpa-system/backend/.env');
    process.exit(3);
  }

  const endpoint = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(SERVICE_ROLE ? { apikey: SERVICE_ROLE } : {})
      }
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }

    console.log('Status:', res.status);
    console.log('Response:');
    console.dir(json, { depth: 4 });
    if (res.status === 200) process.exit(0);
    process.exit(1);
  } catch (e) {
    console.error('Request failed:', e.message || String(e));
    process.exit(4);
  }
}

// Node 18+ has global fetch. If not, instruct the user.
if (typeof fetch === 'undefined') {
  console.error('This script requires Node 18+ (global fetch).');
  process.exit(10);
} else {
  main();
}
