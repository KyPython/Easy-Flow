console.log('dotenv path →', require('path').resolve(__dirname, '..', '.env'));

const fs = require('fs');
const path = require('path');

// Candidate .env locations (relative to this script)
const candidates = [
  path.resolve(__dirname, '..', '.env'),       // backend/.env (preferred)
  path.resolve(__dirname, '..', '..', '.env'), // rpa-system/.env (parent)
  path.resolve(process.cwd(), '.env'),         // cwd .env
];

function chooseEnv() {
  for (const p of candidates) if (fs.existsSync(p)) return p;
  // fallback to the first candidate (same behavior as before) so dotenv still loads something
  return candidates[0];
}

const chosen = chooseEnv();
require('dotenv').config({ path: chosen });

function mask(k){ if(!k) return '<missing>'; if(k.length<=12) return k; return `${k.slice(0,6)}...${k.slice(-4)}`; }

const key = process.env.SUPABASE_SERVICE_ROLE;
console.log('Using .env path →', chosen);
console.log('Loaded SUPABASE_SERVICE_ROLE (masked):', mask(key));
if (!key) {
  console.error('Missing SUPABASE_SERVICE_ROLE in the chosen .env');
  process.exit(1);
}

try {
  const parts = key.split('.');
  if (parts.length < 2) {
    console.error('Token does not look like a JWT.');
    process.exit(2);
  }
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
  console.log('Decoded JWT payload (keys):', Object.keys(payload));
  if (payload.role) console.log('role:', payload.role);
  console.log('expiry (exp):', payload.exp ? new Date(payload.exp * 1000).toISOString() : '<none>');

  // If SUPABASE_URL is present in env, compare project refs
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if (SUPABASE_URL) {
    try {
      const m = SUPABASE_URL.match(/https?:\/\/([^./]+)\.supabase\.co/);
      const projectRef = m ? m[1] : null;
      if (projectRef && payload.ref) {
        if (payload.ref !== projectRef) {
          console.warn(`Mismatch: token.ref (${payload.ref}) !== project ref from SUPABASE_URL (${projectRef}). This usually means the key is for a different project.`);
        } else {
          console.log('Token ref matches SUPABASE_URL project ref.');
        }
      } else if (payload.ref) {
        console.log('Token contains ref:', payload.ref);
      }
    } catch (e) {
      // ignore parsing errors
    }
  }

} catch (err) {
  console.error('Failed to decode JWT payload:', err.message || err);
  process.exit(3);
}