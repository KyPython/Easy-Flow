#!/usr/bin/env node

const { logger, getLogger } = require('../utils/logger');
/*
  Seeds initial workflow templates and versions into Supabase.
  Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node backend/scripts/seed_templates.js
*/
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
  if (!url || !key) {
    logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE/SUPABASE_KEY');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const ownerId = process.env.TEMPLATE_OWNER_ID; // optional fixed owner
  // Create or select a default owner: pick the first auth user if not provided (requires service role)
  let owner = ownerId;
  if (!owner) {
    const { data: users, error: uerr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (uerr) {
      logger.error('Admin listUsers failed:', uerr.message || uerr);
      process.exit(1);
    }
    if (users?.users?.[0]) {
      owner = users.users[0].id;
    } else {
      // Create a system owner user if none exists
      const email = process.env.TEMPLATE_OWNER_EMAIL || `templates-owner+${Date.now()}@example.com`;
      const password = crypto.randomBytes(12).toString('hex');
      const { data: created, error: cerr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (cerr || !created?.user?.id) {
        logger.error('Failed to create owner user. Set TEMPLATE_OWNER_ID to proceed.');
        process.exit(1);
      }
      owner = created.user.id;
      logger.info('Created template owner user:', email);
    }
  }

  const templates = [
    {
      name: 'Slack → Google Sheets',
      description: 'Automatically sync Slack messages to Google Sheets. Perfect for tracking customer feedback, support requests, or team updates without manual copy/paste.',
      category: 'data_processing',
      tags: ['slack', 'google-sheets', 'data-sync', 'copy-paste-elimination'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'New Slack Message' } },
          { id: 'slack-read', type: 'slack', position: { x: 300, y: 100 }, data: { action: 'read_channel', channel: '{{channel}}' } },
          { id: 'sheets-write', type: 'google-sheets', position: { x: 500, y: 100 }, data: { action: 'append_row', sheet: '{{sheet_name}}' } },
          { id: 'end-1', type: 'end', position: { x: 700, y: 100 }, data: { label: 'Done' } }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'slack-read' },
          { id: 'e2', source: 'slack-read', target: 'sheets-write' },
          { id: 'e3', source: 'sheets-write', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Email → Notion',
      description: 'Automatically add emails to Notion database. Stop manually copying email content into your notes - let EasyFlow do it for you.',
      category: 'data_processing',
      tags: ['email', 'notion', 'data-collection', 'copy-paste-elimination'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'New Email Received' } },
          { id: 'email-read', type: 'email', position: { x: 300, y: 100 }, data: { action: 'read', filter: '{{filter}}' } },
          { id: 'notion-create', type: 'notion', position: { x: 500, y: 100 }, data: { action: 'create_page', database: '{{database_id}}' } },
          { id: 'end-1', type: 'end', position: { x: 700, y: 100 }, data: { label: 'Done' } }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'email-read' },
          { id: 'e2', source: 'email-read', target: 'notion-create' },
          { id: 'e3', source: 'notion-create', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Form → CRM',
      description: 'Automatically add form submissions to your CRM. No more copy/pasting customer info from forms to your CRM system.',
      category: 'business_process',
      tags: ['form', 'crm', 'lead-management', 'copy-paste-elimination'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Form Submitted' } },
          { id: 'form-read', type: 'webhook', position: { x: 300, y: 100 }, data: { action: 'receive', endpoint: '{{form_endpoint}}' } },
          { id: 'crm-create', type: 'crm', position: { x: 500, y: 100 }, data: { action: 'create_contact', crm: '{{crm_type}}' } },
          { id: 'end-1', type: 'end', position: { x: 700, y: 100 }, data: { label: 'Done' } }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'form-read' },
          { id: 'e2', source: 'form-read', target: 'crm-create' },
          { id: 'e3', source: 'crm-create', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Web Scrape and Email',
      description: 'Scrape a webpage and email the extracted results.',
      category: 'web_automation',
      tags: ['web', 'scraping', 'email'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'API Poller to CSV',
      description: 'Call an API on a schedule and append results to a CSV in storage.',
      category: 'api_integration',
      tags: ['api', 'storage', 'csv'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    }
  ];

  for (const t of templates) {
    logger.info('Seeding template:', t.name);
    // Upsert by unique key on (owner_id, name) if such constraint exists, else emulate
    let { data: existing, error: exErr } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('owner_id', owner)
      .eq('name', t.name)
      .maybeSingle();
    if (exErr) {
      logger.warn('Lookup existing template failed (continuing):', exErr.message || exErr);
    }
    let inserted = existing;
    if (!existing) {
      const { data: ins, error: terr } = await supabase
        .from('workflow_templates')
        .insert({
          owner_id: owner,
          name: t.name,
          description: t.description,
          category: t.category,
          tags: t.tags,
          is_public: t.is_public,
          status: t.status,
          usage_count: 0,
          rating: 4.0
        })
        .select()
        .single();
      if (terr) {
        logger.error('Insert template error:', terr.message || terr);
        continue;
      }
      inserted = ins;
    }
    if (terr) {
      logger.error('Insert template error:', terr.message || terr);
      continue;
    }

    // Check for existing same version
    let { data: verExisting } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', inserted.id)
      .eq('version', t.version)
      .maybeSingle();
    let ver = verExisting;
    if (!verExisting) {
      const { data: v, error: verr } = await supabase
        .from('template_versions')
        .insert({
          template_id: inserted.id,
          version: t.version,
          config: t.config,
          submitted_by: owner,
          approved_at: new Date().toISOString()
        })
        .select()
        .single();
      if (verr) {
        logger.error('Insert version error:', verr.message || verr);
        continue;
      }
      ver = v;
    }
    if (verr) {
      logger.error('Insert version error:', verr.message || verr);
      continue;
    }

    await supabase
      .from('workflow_templates')
      .update({ latest_version_id: ver.id })
      .eq('id', inserted.id);
  }

  logger.info('Template seed complete.');
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
