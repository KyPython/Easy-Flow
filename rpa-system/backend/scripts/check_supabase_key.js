
const { logger } = require('../utils/logger');
logger.info('dotenv path ->', require('path').resolve(__dirname, '..', '.env'));

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Candidate .env locations (same strategy as inspect script)
const candidates = [
 path.resolve(__dirname, '..', '.env'), // backend/.env (preferred)
 path.resolve(__dirname, '..', '..', '.env'), // rpa-system/.env (parent)
 path.resolve(process.cwd(), '.env') // cwd .env
];

function chooseEnv() {
 for (const p of candidates) if (fs.existsSync(p)) return p;
 return candidates[0];
}

const chosen = chooseEnv();
require('dotenv').config({ path: chosen });

function mask(k){ if(!k) return '<missing>'; if(k.length<=12) return k; return `${k.slice(0,6)}...${k.slice(-4)}`; }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

logger.info('Using .env path ->', chosen);
logger.info('Loaded SUPABASE_SERVICE_ROLE (masked):', mask(SUPABASE_SERVICE_ROLE));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
 logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in the chosen .env');
 process.exit(1);
}

// Decode token and optionally compare project ref from SUPABASE_URL
try {
 const parts = SUPABASE_SERVICE_ROLE.split('.');
 if (parts.length >= 2) {
 const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
 // check project ref
 if (payload.ref) {
 const m = SUPABASE_URL.match(/https?:\/\/([^./]+)\.supabase\.co/);
 const projectRef = m ? m[1] : null;
 if (projectRef && payload.ref !== projectRef) {
 logger.warn(`Supabase key project mismatch: token.ref=${payload.ref} vs SUPABASE_URL project=${projectRef}`);
 }
 }
 // check role claim
 if (!payload.role) {
 logger.warn('Supabase key does NOT contain a `role` claim. Server operations require a Service Role key (role: "service_role").');
 logger.warn('This often means you pasted an anon key, a different project key, or a malformed token into backend/.env.');
 } else if (payload.role !== 'service_role') {
 logger.warn(`Supabase key role is '${payload.role}' but should be 'service_role' for server-side privileged operations.`);
 } else {
 logger.info('Supabase token has correct role: service_role');
 }
 }
} catch (e) {
 // ignore decode errors; we'll surface API errors below
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

(async () => {
 try {
 const { data, error } = await supabase.from('profiles').select('id').limit(1);
 if (error) {
 logger.error('Supabase error:', error);
 process.exit(2);
 }
 logger.info('Supabase query OK, sample data:', data);
 process.exit(0);
 } catch (err) {
 logger.error('Unexpected error:', err?.message || err);
 process.exit(3);
 }
})();
