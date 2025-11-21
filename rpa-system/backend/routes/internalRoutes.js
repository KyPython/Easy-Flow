const express = require('express');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const router = express.Router();

// Accept front-end telemetry / error payloads to help diagnose freezes.
// This endpoint is intentionally public (no auth) so the dev dashboard can POST
// errors when reproducing issues locally. Payloads are written to the repo's
// `diagnostics/` directory to make collection easy.
router.post('/front-errors', async (req, res) => {
  try {
    const payload = req.body || {};
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    // Prefer repo-level diagnostics/ if available (repo root is three levels up),
    // otherwise fall back to rpa-system/diagnostics for backward compatibility.
    const repoDiagnostics = path.resolve(__dirname, '..', '..', '..', 'diagnostics');
    const localDiagnostics = path.resolve(__dirname, '..', '..', 'diagnostics');
    let diagDir = repoDiagnostics;
    try {
      // try creating repo-level diagnostics if possible
      fs.mkdirSync(repoDiagnostics, { recursive: true });
    } catch (e) {
      diagDir = localDiagnostics;
      try { fs.mkdirSync(localDiagnostics, { recursive: true }); } catch (e) {}
    }
    const filename = path.join(diagDir, `${ts}-frontend-error.json`);
    const meta = {
      received_at: new Date().toISOString(),
      remote_ip: (req.ip || req.headers['x-forwarded-for'] || '').toString(),
      user_agent: req.get('user-agent') || null,
      url: req.body?.url || req.get('referer') || req.get('origin') || null
    };
    const out = { meta, payload };
    fs.writeFileSync(filename, JSON.stringify(out, null, 2), 'utf8');
    logger.info('[internal/front-errors] saved frontend error payload', { file: filename });
    return res.status(204).send();
  } catch (err) {
    try { logger.error('[internal/front-errors] failed to persist payload', err?.message || err); } catch (e) { console.error(e); }
    return res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
