const express = require('express');
const router = express.Router();

// Minimal referral route placeholder to satisfy app.js require. Replace with real implementation later.
router.get('/referrals/health', (_req, res) => {
  res.json({ ok: true });
});

module.exports = { router };
