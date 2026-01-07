require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  logger.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // Get system user or create one
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const owner = users?.[0]?.id || '00000000-0000-0000-0000-000000000000';

  const templates = [
    {
      name: 'Monitor Airtable Usage',
      description: 'Proactively monitor Airtable usage to prevent surprise bills. Automatically logs into your Airtable account, checks record count, base count, and API usage, then alerts you BEFORE you hit plan limits. Prevents $12K surprise scenarios by catching usage spikes early.',
      category: 'subscription_monitoring',
      tags: ['airtable', 'usage-monitoring', 'proactive', 'subscription', 'cost-control'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Daily Usage Check' }
          },
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: {
              url: 'https://airtable.com/account',
              action: 'navigate'
            }
          },
          {
            id: 'login-1',
            type: 'fill_form',
            position: { x: 500, y: 100 },
            data: {
              action: 'login',
              email_selector: 'input[type="email"]',
              password_selector: 'input[type="password"]',
              submit_selector: 'button[type="submit"]'
            }
          },
          {
            id: 'extract-1',
            type: 'extract_data',
            position: { x: 700, y: 100 },
            data: {
              selectors: {
                records: '.usage-stats .records-count',
                bases: '.usage-stats .bases-count',
                api_calls: '.usage-stats .api-calls',
                plan_name: '.plan-info .plan-name'
              }
            }
          },
          {
            id: 'update-usage',
            type: 'custom_action',
            position: { x: 900, y: 100 },
            data: {
              action: 'update_subscription_usage',
              service: 'airtable'
            }
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1100, y: 100 },
            data: { label: 'Usage Checked' }
          }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'login-1' },
          { id: 'e3', source: 'login-1', target: 'extract-1' },
          { id: 'e4', source: 'extract-1', target: 'update-usage' },
          { id: 'e5', source: 'update-usage', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Monitor Render Usage',
      description: 'Check Render service usage daily to catch cost spikes before they become bills. Monitors CPU hours, bandwidth, disk usage, and service count. Alerts you when approaching plan limits or unexpected usage patterns.',
      category: 'subscription_monitoring',
      tags: ['render', 'usage-monitoring', 'proactive', 'subscription', 'cost-control'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Daily Usage Check' }
          },
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: {
              url: 'https://dashboard.render.com',
              action: 'navigate'
            }
          },
          {
            id: 'login-1',
            type: 'fill_form',
            position: { x: 500, y: 100 },
            data: {
              action: 'login',
              email_selector: 'input[type="email"]',
              password_selector: 'input[type="password"]',
              submit_selector: 'button[type="submit"]'
            }
          },
          {
            id: 'extract-1',
            type: 'extract_data',
            position: { x: 700, y: 100 },
            data: {
              selectors: {
                cpu_hours: '.usage-metrics .cpu-hours',
                bandwidth_gb: '.usage-metrics .bandwidth',
                disk_gb: '.usage-metrics .disk-usage',
                services_count: '.services-list .service-count',
                current_cost: '.billing-summary .current-cost'
              }
            }
          },
          {
            id: 'update-usage',
            type: 'custom_action',
            position: { x: 900, y: 100 },
            data: {
              action: 'update_subscription_usage',
              service: 'render'
            }
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1100, y: 100 },
            data: { label: 'Usage Checked' }
          }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'login-1' },
          { id: 'e3', source: 'login-1', target: 'extract-1' },
          { id: 'e4', source: 'extract-1', target: 'update-usage' },
          { id: 'e5', source: 'update-usage', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Monitor QuotaGuard Usage',
      description: 'Track QuotaGuard proxy usage to avoid overage charges. Monitors proxy requests, bandwidth, and concurrent connections. Get alerts before hitting plan limits on this pay-as-you-go service.',
      category: 'subscription_monitoring',
      tags: ['quotaguard', 'usage-monitoring', 'proactive', 'subscription', 'cost-control'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Daily Usage Check' }
          },
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: {
              url: 'https://www.quotaguard.com/dashboard',
              action: 'navigate'
            }
          },
          {
            id: 'login-1',
            type: 'fill_form',
            position: { x: 500, y: 100 },
            data: {
              action: 'login',
              email_selector: 'input[type="email"]',
              password_selector: 'input[type="password"]',
              submit_selector: 'button[type="submit"]'
            }
          },
          {
            id: 'extract-1',
            type: 'extract_data',
            position: { x: 700, y: 100 },
            data: {
              selectors: {
                proxy_requests: '.usage-stats .proxy-requests',
                bandwidth_gb: '.usage-stats .bandwidth',
                connections: '.usage-stats .concurrent-connections',
                current_cost: '.billing .current-period-cost'
              }
            }
          },
          {
            id: 'update-usage',
            type: 'custom_action',
            position: { x: 900, y: 100 },
            data: {
              action: 'update_subscription_usage',
              service: 'quotaguard'
            }
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1100, y: 100 },
            data: { label: 'Usage Checked' }
          }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'login-1' },
          { id: 'e3', source: 'login-1', target: 'extract-1' },
          { id: 'e4', source: 'extract-1', target: 'update-usage' },
          { id: 'e5', source: 'update-usage', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      name: 'Cancel Subscription (Generic)',
      description: 'Automated subscription cancellation workflow. Navigates to billing page, finds cancel button, executes cancellation, and confirms. Works with most subscription services that have web-based cancellation.',
      category: 'subscription_monitoring',
      tags: ['cancellation', 'subscription', 'automation', 'billing'],
      is_public: true,
      status: 'approved',
      version: '1.0.0',
      config: {
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: 'Cancel Subscription' }
          },
          {
            id: 'navigate-1',
            type: 'navigate',
            position: { x: 300, y: 100 },
            data: {
              url: '{{cancel_link}}',
              action: 'navigate'
            }
          },
          {
            id: 'login-1',
            type: 'fill_form',
            position: { x: 500, y: 100 },
            data: {
              action: 'login',
              email_selector: 'input[type="email"]',
              password_selector: 'input[type="password"]',
              submit_selector: 'button[type="submit"]'
            }
          },
          {
            id: 'find-cancel',
            type: 'click_element',
            position: { x: 700, y: 100 },
            data: {
              selector: 'button:contains("Cancel"), a:contains("Cancel"), .cancel-button, [data-action="cancel"]',
              action: 'click'
            }
          },
          {
            id: 'confirm-cancel',
            type: 'fill_form',
            position: { x: 900, y: 100 },
            data: {
              action: 'confirm',
              reason_selector: 'textarea[name="reason"], select[name="reason"]',
              confirm_selector: 'button:contains("Confirm"), button:contains("Yes, cancel")'
            }
          },
          {
            id: 'verify-cancel',
            type: 'extract_data',
            position: { x: 1100, y: 100 },
            data: {
              selectors: {
                confirmation_message: '.success-message, .confirmation-message',
                cancellation_date: '.cancellation-date'
              }
            }
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1300, y: 100 },
            data: { label: 'Cancelled' }
          }
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'navigate-1' },
          { id: 'e2', source: 'navigate-1', target: 'login-1' },
          { id: 'e3', source: 'login-1', target: 'find-cancel' },
          { id: 'e4', source: 'find-cancel', target: 'confirm-cancel' },
          { id: 'e5', source: 'confirm-cancel', target: 'verify-cancel' },
          { id: 'e6', source: 'verify-cancel', target: 'end-1' }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    }
  ];

  for (const t of templates) {
    logger.info('Seeding template:', t.name);

    // Check if template exists
    let { data: existing } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('owner_id', owner)
      .eq('name', t.name)
      .maybeSingle();

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

    // Check for existing version
    let { data: verExisting } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', inserted.id)
      .eq('version', t.version)
      .maybeSingle();

    if (!verExisting) {
      const { error: verr } = await supabase
        .from('template_versions')
        .insert({
          template_id: inserted.id,
          version: t.version,
          config: t.config,
          submitted_by: owner,
          approved_at: new Date().toISOString()
        });

      if (verr) {
        logger.error('Insert version error:', verr.message || verr);
        continue;
      }
    }

    // Update latest version
    const { data: latestVersion } = await supabase
      .from('template_versions')
      .select('id')
      .eq('template_id', inserted.id)
      .eq('version', t.version)
      .single();

    if (latestVersion) {
      await supabase
        .from('workflow_templates')
        .update({ latest_version_id: latestVersion.id })
        .eq('id', inserted.id);
    }

    logger.info(`✅ Template "${t.name}" seeded successfully`);
  }

  logger.info('✅ All subscription monitoring templates seeded!');
}

main().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});

