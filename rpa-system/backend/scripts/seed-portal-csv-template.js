#!/usr/bin/env node

/**
 * Quick seed script to create "Portal CSV Export" template for $197 automation delivery
 * Run: node scripts/seed-portal-csv-template.js
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPortalCSVTemplate() {
  console.log('🌱 Seeding Portal CSV Export template...');

  // Find template owner (system user or first admin)
  const { data: ownerUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'templates@easyflow.com')
    .maybeSingle();

  let ownerId = ownerUser?.id;

  if (!ownerId) {
    // Create system template owner if doesn't exist
    const { data: newOwner } = await supabase.auth.admin.createUser({
      email: 'templates@easyflow.com',
      password: crypto.randomBytes(32).toString('hex'),
      email_confirm: true
    });

    if (newOwner?.user) {
      ownerId = newOwner.user.id;
      console.log('✅ Created template owner user');
    } else {
      // Fallback: use first user
      const { data: firstUser } = await supabase
        .from('users')
        .select('id')
        .limit(1)
        .maybeSingle();
      ownerId = firstUser?.id;
      console.log('⚠️  Using first user as template owner');
    }
  }

  if (!ownerId) {
    console.error('❌ No user found to own template');
    process.exit(1);
  }

  const template = {
    name: 'Portal CSV Export',
    description: 'Login to a portal, navigate to a data page, scrape table data, and export to CSV. Perfect for automating weekly/monthly data exports from vendor portals, dashboards, or internal systems without APIs.',
    category: 'data_extraction',
    tags: ['portal', 'csv', 'export', 'login', 'scraping', 'automation'],
    is_public: true,
    status: 'approved',
    version: '1.0.0',
    config: {
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 200 },
          data: {
            label: 'Start',
            step_type: 'start'
          }
        },
        {
          id: 'login-step',
          type: 'web_automation',
          position: { x: 350, y: 200 },
          data: {
            label: 'Login to Portal',
            step_type: 'web_automation',
            action: 'login',
            config: {
              url: '{{portal_url}}',
              username: '{{username}}',
              password: '{{password}}',
              wait_after: 3
            }
          }
        },
        {
          id: 'navigate-step',
          type: 'web_automation',
          position: { x: 600, y: 200 },
          data: {
            label: 'Navigate to Data Page',
            step_type: 'web_automation',
            action: 'navigate',
            config: {
              url: '{{data_page_url}}',
              wait_after: 2
            }
          }
        },
        {
          id: 'scrape-step',
          type: 'web_scraping',
          position: { x: 850, y: 200 },
          data: {
            label: 'Scrape Table Data',
            step_type: 'web_scraping',
            config: {
              url: '{{data_page_url}}',
              selectors: {
                table: '{{table_selector}}', // e.g., 'table.data-table' or 'div.data-grid'
                rows: '{{row_selector}}',    // e.g., 'tbody tr' or 'div.data-row'
                columns: '{{column_selectors}}' // e.g., ['td:nth-child(1)', 'td:nth-child(2)']
              },
              extract_format: 'table'
            }
          }
        },
        {
          id: 'export-step',
          type: 'data_transform',
          position: { x: 1100, y: 200 },
          data: {
            label: 'Export to CSV',
            step_type: 'data_transform',
            config: {
              input_data: '{{scrape-step.output}}',
              output_format: 'csv',
              destination: {
                type: 'file',
                filename: '{{export_filename}}',
                path: './exports'
              }
            }
          }
        },
        {
          id: 'end-1',
          type: 'end',
          position: { x: 1350, y: 200 },
          data: {
            label: 'Done',
            step_type: 'end'
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'login-step' },
        { id: 'e2', source: 'login-step', target: 'navigate-step' },
        { id: 'e3', source: 'navigate-step', target: 'scrape-step' },
        { id: 'e4', source: 'scrape-step', target: 'export-step' },
        { id: 'e5', source: 'export-step', target: 'end-1' }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };

  // Check if template already exists
  const { data: existing } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('name', template.name)
    .maybeSingle();

  let templateId;
  if (existing) {
    templateId = existing.id;
    console.log('ℹ️  Template already exists, updating...');
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('workflow_templates')
      .insert({
        owner_id: ownerId,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        is_public: template.is_public,
        status: template.status,
        usage_count: 0,
        rating: 5.0
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Failed to insert template:', insertError);
      process.exit(1);
    }

    templateId = inserted.id;
    console.log('✅ Template created:', templateId);
  }

  // Create/update template version
  const { data: versionExisting } = await supabase
    .from('template_versions')
    .select('*')
    .eq('template_id', templateId)
    .eq('version', template.version)
    .maybeSingle();

  if (!versionExisting) {
    const { error: versionError } = await supabase
      .from('template_versions')
      .insert({
        template_id: templateId,
        version: template.version,
        config: template.config,
        submitted_by: ownerId,
        approved_at: new Date().toISOString()
      });

    if (versionError) {
      console.error('❌ Failed to create version:', versionError);
      process.exit(1);
    }

    // Update latest_version_id
    await supabase
      .from('workflow_templates')
      .update({ latest_version_id: templateId })
      .eq('id', templateId);

    console.log('✅ Template version created');
  } else {
    console.log('ℹ️  Template version already exists');
  }

  console.log('🎉 Portal CSV Export template seeded successfully!');
  console.log('📝 Template ID:', templateId);
  console.log('📋 Usage: Clients can select "Portal CSV Export" from templates to quickly create login → navigate → export workflows');
}

seedPortalCSVTemplate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
