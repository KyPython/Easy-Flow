const fs = require('fs');
const path = require('path');
const { meterAction } = require('../rpa-system/backend/lib/actionMeter');

// Load env (reuse resolution strategy)
const candidates = [
  path.resolve(__dirname, '..', 'rpa-system', 'backend', '.env'),
  path.resolve(__dirname, '..', 'rpa-system', '.env'),
  path.resolve(process.cwd(), '.env')
];
function chooseEnv() { for (const p of candidates) if (fs.existsSync(p)) return p; return candidates[0]; }
require('dotenv').config({ path: chooseEnv() });

(async () => {
  try {
    const res = await meterAction({
      actionType: 'test.node.meter',
      payload: { ok: true, ts: new Date().toISOString() }
    });
    if (res && res.error) {
      console.error('❌ Meter helper failed:', res.error?.message || res.error);
      process.exit(1);
    }
    console.log('✅ Meter helper OK:', res?.data || null);
    process.exit(0);
  } catch (e) {
    console.error('❌ Unexpected error:', e?.message || e);
    process.exit(2);
  }
})();
