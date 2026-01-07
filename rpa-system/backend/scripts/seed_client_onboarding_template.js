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

  const template = {
    name: 'Agency Client Onboarding Automation',
    description: 'Complete backend automation for client onboarding. Takes client data from Typeform/webhook, then automatically: (1) Creates Google Drive folder structure with client folders, (2) Creates Slack channels and invites client, (3) Creates Asana/ClickUp project from template, (4) Populates all systems with client data. Saves agencies 20-30 hours/month of manual onboarding admin work.',
    category: 'business_process',
    tags: ['onboarding', 'agency', 'automation', 'google-drive', 'slack', 'asana', 'clickup', 'client-management'],
    is_public: true,
    status: 'approved',
    version: '1.0.0',
    config: {
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'New Client Form Submitted' }
        },
        {
          id: 'extract-data',
          type: 'data_transform',
          position: { x: 300, y: 100 },
          data: {
            action: 'extract',
            source: '{{webhook_body}}',
            fields: {
              client_name: '{{client_name}}',
              client_email: '{{client_email}}',
              company_name: '{{company_name}}',
              project_type: '{{project_type}}',
              start_date: '{{start_date}}',
              notes: '{{notes}}'
            }
          }
        },
        {
          id: 'create-drive-folder',
          type: 'google_drive',
          position: { x: 500, y: 50 },
          data: {
            action: 'create_folder',
            folder_name: '{{client_name}} - {{company_name}}',
            parent_folder_id: '{{PARENT_FOLDER_ID}}',
            subfolders: [
              '01 - Contracts',
              '02 - Deliverables',
              '03 - Assets',
              '04 - Communication',
              '05 - Reports'
            ]
          }
        },
        {
          id: 'create-slack-channel',
          type: 'slack',
          position: { x: 500, y: 150 },
          data: {
            action: 'create_channel',
            channel_name: '{{company_name}}',
            is_private: false,
            invite_users: ['{{client_email}}']
          }
        },
        {
          id: 'create-asana-project',
          type: 'api_call',
          position: { x: 700, y: 50 },
          data: {
            method: 'POST',
            url: 'https://app.asana.com/api/1.0/projects',
            headers: {
              'Authorization': 'Bearer {{ASANA_ACCESS_TOKEN}}',
              'Content-Type': 'application/json'
            },
            body: {
              name: '{{company_name}} - {{project_type}}',
              workspace: '{{ASANA_WORKSPACE_ID}}',
              template: '{{ASANA_TEMPLATE_ID}}',
              notes: 'Client: {{client_name}}\nEmail: {{client_email}}\nStart Date: {{start_date}}\nNotes: {{notes}}'
            }
          }
        },
        {
          id: 'populate-drive',
          type: 'google_drive',
          position: { x: 900, y: 50 },
          data: {
            action: 'upload_file',
            folder_id: '{{create-drive-folder.folderId}}',
            file_name: 'client-info.json',
            content: {
              client_name: '{{client_name}}',
              client_email: '{{client_email}}',
              company_name: '{{company_name}}',
              project_type: '{{project_type}}',
              onboarding_date: '{{start_date}}',
              slack_channel: '{{create-slack-channel.channelId}}',
              asana_project: '{{create-asana-project.projectId}}'
            }
          }
        },
        {
          id: 'send-welcome-email',
          type: 'email',
          position: { x: 900, y: 150 },
          data: {
            to: '{{client_email}}',
            subject: 'Welcome to {{company_name}}! Your onboarding is complete',
            template: `Hi {{client_name}},

Welcome! Your onboarding is complete and everything is set up:

📁 Google Drive Folder: {{create-drive-folder.webViewLink}}
💬 Slack Channel: #{{company_name}} (you've been invited)
📋 Project Board: {{create-asana-project.projectLink}}

Next steps:
1. Check your email for Slack invitation
2. Review the Drive folder structure
3. Let's schedule a kickoff call!

Best,
Your Team`
          }
        },
        {
          id: 'notify-team',
          type: 'slack',
          position: { x: 1100, y: 100 },
          data: {
            action: 'send_message',
            channel: '#team-notifications',
            message: `🎉 New client onboarded: {{client_name}} ({{company_name}})

✅ Drive folder created
✅ Slack channel: #{{company_name}}
✅ Asana project created
✅ Welcome email sent

See Drive: {{create-drive-folder.webViewLink}}`
          }
        },
        {
          id: 'end-1',
          type: 'end',
          position: { x: 1300, y: 100 },
          data: { label: 'Onboarding Complete' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'extract-data' },
        { id: 'e2', source: 'extract-data', target: 'create-drive-folder' },
        { id: 'e3', source: 'extract-data', target: 'create-slack-channel' },
        { id: 'e4', source: 'extract-data', target: 'create-asana-project' },
        { id: 'e5', source: 'create-drive-folder', target: 'populate-drive' },
        { id: 'e6', source: 'create-slack-channel', target: 'send-welcome-email' },
        { id: 'e7', source: 'create-asana-project', target: 'send-welcome-email' },
        { id: 'e8', source: 'populate-drive', target: 'notify-team' },
        { id: 'e9', source: 'send-welcome-email', target: 'notify-team' },
        { id: 'e10', source: 'notify-team', target: 'end-1' }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };

  logger.info('Seeding template:', template.name);

  // Check if template exists
  let { data: existing } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('owner_id', owner)
    .eq('name', template.name)
    .maybeSingle();

  let inserted = existing;
  if (!existing) {
    const { data: ins, error: terr } = await supabase
      .from('workflow_templates')
      .insert({
        owner_id: owner,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        is_public: template.is_public,
        status: template.status,
        usage_count: 0,
        rating: 4.5
      })
      .select()
      .single();

    if (terr) {
      logger.error('Insert template error:', terr.message || terr);
      process.exit(1);
    }
    inserted = ins;
  }

  // Check for existing version
  let { data: verExisting } = await supabase
    .from('template_versions')
    .select('*')
    .eq('template_id', inserted.id)
    .eq('version', template.version)
    .maybeSingle();

  if (!verExisting) {
    const { error: verr } = await supabase
      .from('template_versions')
      .insert({
        template_id: inserted.id,
        version: template.version,
        config: template.config,
        submitted_by: owner,
        approved_at: new Date().toISOString()
      });

    if (verr) {
      logger.error('Insert version error:', verr.message || verr);
      process.exit(1);
    }
  }

  // Update latest version
  const { data: latestVersion } = await supabase
    .from('template_versions')
    .select('id')
    .eq('template_id', inserted.id)
    .eq('version', template.version)
    .single();

  if (latestVersion) {
    await supabase
      .from('workflow_templates')
      .update({ latest_version_id: latestVersion.id })
      .eq('id', inserted.id);
  }

  logger.info(`✅ Template "${template.name}" seeded successfully!`);
  logger.info('\n📋 What this workflow does:');
  logger.info('   1. Extracts client data from Typeform/webhook');
  logger.info('   2. Creates Google Drive folder structure');
  logger.info('   3. Creates Slack channel and invites client');
  logger.info('   4. Creates Asana project from template');
  logger.info('   5. Populates all systems with client info');
  logger.info('   6. Sends welcome email to client');
  logger.info('   7. Notifies team in Slack');
  logger.info('\n💡 Saves 20-30 hours/month of manual onboarding work!');
}

main().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});

