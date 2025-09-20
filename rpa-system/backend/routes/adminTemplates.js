const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const requireFeature = require('../middleware/planEnforcement');

// Simple admin-secret middleware (separate from user auth)
router.use((req, res, next) => {
  const adminSecret = req.headers['x-admin-secret'];
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected) return res.status(500).json({ error: 'ADMIN_API_SECRET not configured' });
  if (!adminSecret || adminSecret !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const supabase = process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  // eslint-disable-next-line no-console
  console.warn('[adminTemplates] Supabase not initialized. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE');
}

// List templates for moderation
router.get('/', requireFeature('admin_templates'), async (req, res) => {
  try {
    const status = req.query.status || 'pending_review';
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .in('status', status === 'all' ? ['draft','pending_review','approved','rejected','archived'] : [status])
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ templates: data || [] });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[adminTemplates] list error', e?.message || e);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// Approve a template and optionally a specific version
router.post('/:id/approve', requireFeature('admin_templates'), async (req, res) => {
  try {
    const id = req.params.id;
    const { version_id, review_notes } = req.body || {};

    // Approve template
    const { error: upErr } = await supabase
      .from('workflow_templates')
      .update({ status: 'approved', is_public: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (upErr) throw upErr;

    // Mark version reviewed/approved (if provided)
    if (version_id) {
      const { error: verErr } = await supabase
        .from('template_versions')
        .update({ reviewed_by: null, approved_at: new Date().toISOString(), review_notes })
        .eq('id', version_id);
      if (verErr) throw verErr;
    }

    res.json({ success: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[adminTemplates] approve error', e?.message || e);
    res.status(500).json({ error: 'Failed to approve template' });
  }
});

// Reject a template with notes
router.post('/:id/reject', requireFeature('admin_templates'), async (req, res) => {
  try {
    const id = req.params.id;
    const { review_notes } = req.body || {};

    const { error } = await supabase
      .from('workflow_templates')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    // Optionally record notes on latest version
    if (review_notes) {
      await supabase
        .from('template_versions')
        .update({ review_notes })
        .eq('template_id', id);
    }

    res.json({ success: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[adminTemplates] reject error', e?.message || e);
    res.status(500).json({ error: 'Failed to reject template' });
  }
});

module.exports = router;
