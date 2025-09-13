-- ============================================================================
-- EASYFLOW WORKFLOW TEMPLATES - REAL PRODUCTION TEMPLATES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to add real workflow templates

-- First, ensure we have a user to assign as template creator
-- This will use an existing user or you can replace with a specific user_id

-- Create a dummy workflow first for source_workflow_id references
-- In production, you'd reference actual existing workflows
INSERT INTO public.workflows (id, user_id, name, description, status) 
SELECT 
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Template Source Workflow',
    'Dummy workflow for template references',
    'active'
WHERE EXISTS (SELECT 1 FROM auth.users);

-- Insert real workflow templates
-- Note: created_by will reference your user ID, display name handled in frontend
INSERT INTO public.workflow_templates (
    created_by,
    source_workflow_id,
    name,
    description,
    category,
    tags,
    template_config,
    required_inputs,
    expected_outputs,
    usage_count,
    rating,
    is_public,
    is_featured,
    published_at
) VALUES

-- 1. Email Marketing Automation
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'Email Marketing Automation',
    'Automated email sequences for lead nurturing, welcome series, and customer onboarding. Triggers emails based on user actions and engagement.',
    'email_marketing',
    ARRAY['email', 'marketing', 'automation', 'nurturing', 'leads'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "trigger", "type": "condition", "position": {"x": 100, "y": 200}, "data": {"label": "User Signup"}},
            {"id": "delay", "type": "action", "position": {"x": 100, "y": 300}, "data": {"action_type": "delay", "label": "Wait 1 Hour"}},
            {"id": "email1", "type": "action", "position": {"x": 100, "y": 400}, "data": {"action_type": "email", "label": "Welcome Email"}},
            {"id": "delay2", "type": "action", "position": {"x": 100, "y": 500}, "data": {"action_type": "delay", "label": "Wait 3 Days"}},
            {"id": "email2", "type": "action", "position": {"x": 100, "y": 600}, "data": {"action_type": "email", "label": "Follow-up Email"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 700}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "trigger"},
            {"id": "e2", "source": "trigger", "target": "delay"},
            {"id": "e3", "source": "delay", "target": "email1"},
            {"id": "e4", "source": "email1", "target": "delay2"},
            {"id": "e5", "source": "delay2", "target": "email2"},
            {"id": "e6", "source": "email2", "target": "end"}
        ]
    }',
    '[
        {"name": "user_email", "type": "string", "required": true, "description": "Email address of the user"},
        {"name": "user_name", "type": "string", "required": false, "description": "Name of the user for personalization"},
        {"name": "signup_source", "type": "string", "required": false, "description": "Where the user signed up from"}
    ]',
    '[
        {"name": "emails_sent", "type": "number", "description": "Number of emails successfully sent"},
        {"name": "campaign_id", "type": "string", "description": "ID of the email campaign"},
        {"name": "completion_status", "type": "string", "description": "Success or failure status"}
    ]',
    0,
    0.0,
    true,
    true,
    NOW()
),

-- 2. Web Data Scraping & Processing
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'Web Data Scraping & Processing',
    'Automatically scrape product data, prices, or content from websites. Includes data cleaning, transformation, and storage.',
    'web_automation',
    ARRAY['scraping', 'data', 'web', 'extraction', 'monitoring'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "scrape", "type": "action", "position": {"x": 100, "y": 200}, "data": {"action_type": "web_scrape", "label": "Scrape Website"}},
            {"id": "transform", "type": "action", "position": {"x": 100, "y": 300}, "data": {"action_type": "data_transform", "label": "Clean Data"}},
            {"id": "condition", "type": "condition", "position": {"x": 100, "y": 400}, "data": {"label": "Data Valid?"}},
            {"id": "store", "type": "action", "position": {"x": 200, "y": 500}, "data": {"action_type": "api_call", "label": "Store Data"}},
            {"id": "error", "type": "action", "position": {"x": 0, "y": 500}, "data": {"action_type": "email", "label": "Send Error Alert"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 600}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "scrape"},
            {"id": "e2", "source": "scrape", "target": "transform"},
            {"id": "e3", "source": "transform", "target": "condition"},
            {"id": "e4", "source": "condition", "target": "store", "data": {"condition": "valid"}},
            {"id": "e5", "source": "condition", "target": "error", "data": {"condition": "invalid"}},
            {"id": "e6", "source": "store", "target": "end"},
            {"id": "e7", "source": "error", "target": "end"}
        ]
    }',
    '[
        {"name": "target_url", "type": "string", "required": true, "description": "URL to scrape data from"},
        {"name": "selectors", "type": "object", "required": true, "description": "CSS selectors for data extraction"},
        {"name": "notification_email", "type": "string", "required": false, "description": "Email for error notifications"}
    ]',
    '[
        {"name": "scraped_data", "type": "array", "description": "Array of scraped and processed data"},
        {"name": "record_count", "type": "number", "description": "Number of records processed"},
        {"name": "execution_time", "type": "number", "description": "Time taken in seconds"}
    ]',
    0,
    0.0,
    true,
    true,
    NOW()
),

-- 3. File Processing & Organization
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'File Processing & Organization',
    'Automatically process uploaded files, extract metadata, organize by type, and trigger appropriate workflows based on file content.',
    'file_management',
    ARRAY['files', 'processing', 'organization', 'upload', 'metadata'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "upload", "type": "action", "position": {"x": 100, "y": 200}, "data": {"action_type": "file_upload", "label": "Process Upload"}},
            {"id": "analyze", "type": "condition", "position": {"x": 100, "y": 300}, "data": {"label": "Analyze File Type"}},
            {"id": "process_image", "type": "action", "position": {"x": 0, "y": 400}, "data": {"action_type": "data_transform", "label": "Process Image"}},
            {"id": "process_doc", "type": "action", "position": {"x": 100, "y": 400}, "data": {"action_type": "data_transform", "label": "Process Document"}},
            {"id": "process_data", "type": "action", "position": {"x": 200, "y": 400}, "data": {"action_type": "data_transform", "label": "Process Data File"}},
            {"id": "organize", "type": "action", "position": {"x": 100, "y": 500}, "data": {"action_type": "file_upload", "label": "Organize & Store"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 600}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "upload"},
            {"id": "e2", "source": "upload", "target": "analyze"},
            {"id": "e3", "source": "analyze", "target": "process_image", "data": {"condition": "image"}},
            {"id": "e4", "source": "analyze", "target": "process_doc", "data": {"condition": "document"}},
            {"id": "e5", "source": "analyze", "target": "process_data", "data": {"condition": "data"}},
            {"id": "e6", "source": "process_image", "target": "organize"},
            {"id": "e7", "source": "process_doc", "target": "organize"},
            {"id": "e8", "source": "process_data", "target": "organize"},
            {"id": "e9", "source": "organize", "target": "end"}
        ]
    }',
    '[
        {"name": "file_data", "type": "string", "required": true, "description": "Base64 encoded file data or file path"},
        {"name": "file_name", "type": "string", "required": true, "description": "Original filename"},
        {"name": "organization_rules", "type": "object", "required": false, "description": "Custom organization rules"}
    ]',
    '[
        {"name": "file_url", "type": "string", "description": "URL of the processed and stored file"},
        {"name": "metadata", "type": "object", "description": "Extracted file metadata"},
        {"name": "category", "type": "string", "description": "Determined file category"}
    ]',
    0,
    0.0,
    true,
    false,
    NOW()
),

-- 4. API Data Sync & Integration
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'API Data Sync & Integration',
    'Synchronize data between different services and APIs. Perfect for CRM integration, inventory sync, or customer data management.',
    'api_integration',
    ARRAY['api', 'sync', 'integration', 'crm', 'data'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "fetch_source", "type": "action", "position": {"x": 100, "y": 200}, "data": {"action_type": "api_call", "label": "Fetch from Source API"}},
            {"id": "transform", "type": "action", "position": {"x": 100, "y": 300}, "data": {"action_type": "data_transform", "label": "Transform Data"}},
            {"id": "validate", "type": "condition", "position": {"x": 100, "y": 400}, "data": {"label": "Validate Data"}},
            {"id": "update_target", "type": "action", "position": {"x": 200, "y": 500}, "data": {"action_type": "api_call", "label": "Update Target API"}},
            {"id": "log_error", "type": "action", "position": {"x": 0, "y": 500}, "data": {"action_type": "email", "label": "Log Error"}},
            {"id": "notify", "type": "action", "position": {"x": 100, "y": 600}, "data": {"action_type": "email", "label": "Send Summary"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 700}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "fetch_source"},
            {"id": "e2", "source": "fetch_source", "target": "transform"},
            {"id": "e3", "source": "transform", "target": "validate"},
            {"id": "e4", "source": "validate", "target": "update_target", "data": {"condition": "valid"}},
            {"id": "e5", "source": "validate", "target": "log_error", "data": {"condition": "invalid"}},
            {"id": "e6", "source": "update_target", "target": "notify"},
            {"id": "e7", "source": "log_error", "target": "end"},
            {"id": "e8", "source": "notify", "target": "end"}
        ]
    }',
    '[
        {"name": "source_api_endpoint", "type": "string", "required": true, "description": "Source API endpoint URL"},
        {"name": "target_api_endpoint", "type": "string", "required": true, "description": "Target API endpoint URL"},
        {"name": "api_credentials", "type": "object", "required": true, "description": "API authentication credentials"},
        {"name": "sync_frequency", "type": "string", "required": false, "description": "How often to sync (hourly, daily, weekly)"}
    ]',
    '[
        {"name": "records_synced", "type": "number", "description": "Number of records successfully synced"},
        {"name": "sync_status", "type": "string", "description": "Overall sync status"},
        {"name": "error_count", "type": "number", "description": "Number of errors encountered"}
    ]',
    0,
    0.0,
    true,
    true,
    NOW()
),

-- 5. Customer Support Automation
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'Customer Support Automation',
    'Automate customer support workflows including ticket routing, auto-responses, and escalation based on priority and keywords.',
    'business_process',
    ARRAY['support', 'tickets', 'automation', 'customer', 'routing'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "analyze_ticket", "type": "condition", "position": {"x": 100, "y": 200}, "data": {"label": "Analyze Ticket Content"}},
            {"id": "auto_reply", "type": "action", "position": {"x": 0, "y": 300}, "data": {"action_type": "email", "label": "Send Auto-Reply"}},
            {"id": "check_priority", "type": "condition", "position": {"x": 100, "y": 300}, "data": {"label": "Check Priority"}},
            {"id": "escalate", "type": "action", "position": {"x": 200, "y": 300}, "data": {"action_type": "email", "label": "Escalate to Manager"}},
            {"id": "assign_agent", "type": "action", "position": {"x": 100, "y": 400}, "data": {"action_type": "api_call", "label": "Assign to Agent"}},
            {"id": "notify_customer", "type": "action", "position": {"x": 100, "y": 500}, "data": {"action_type": "email", "label": "Notify Customer"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 600}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "analyze_ticket"},
            {"id": "e2", "source": "analyze_ticket", "target": "auto_reply", "data": {"condition": "faq"}},
            {"id": "e3", "source": "analyze_ticket", "target": "check_priority", "data": {"condition": "complex"}},
            {"id": "e4", "source": "check_priority", "target": "escalate", "data": {"condition": "high"}},
            {"id": "e5", "source": "check_priority", "target": "assign_agent", "data": {"condition": "normal"}},
            {"id": "e6", "source": "escalate", "target": "notify_customer"},
            {"id": "e7", "source": "assign_agent", "target": "notify_customer"},
            {"id": "e8", "source": "auto_reply", "target": "end"},
            {"id": "e9", "source": "notify_customer", "target": "end"}
        ]
    }',
    '[
        {"name": "ticket_content", "type": "string", "required": true, "description": "Content of the support ticket"},
        {"name": "customer_email", "type": "string", "required": true, "description": "Customer email address"},
        {"name": "ticket_category", "type": "string", "required": false, "description": "Pre-categorized ticket type"}
    ]',
    '[
        {"name": "ticket_id", "type": "string", "description": "Generated ticket ID"},
        {"name": "assigned_agent", "type": "string", "description": "Agent assigned to handle the ticket"},
        {"name": "priority_level", "type": "string", "description": "Determined priority level"},
        {"name": "auto_resolved", "type": "boolean", "description": "Whether ticket was auto-resolved"}
    ]',
    0,
    0.0,
    true,
    false,
    NOW()
),

-- 6. Social Media Content Automation
(
    (SELECT id FROM auth.users LIMIT 1), -- created_by
    (SELECT id FROM workflows ORDER BY created_at DESC LIMIT 1), -- source_workflow_id
    'Social Media Content Automation',
    'Automatically create, schedule, and post content across multiple social media platforms. Includes content optimization and engagement tracking.',
    'marketing',
    ARRAY['social', 'content', 'scheduling', 'marketing', 'automation'],
    '{
        "nodes": [
            {"id": "start", "type": "start", "position": {"x": 100, "y": 100}},
            {"id": "generate_content", "type": "action", "position": {"x": 100, "y": 200}, "data": {"action_type": "data_transform", "label": "Generate Content"}},
            {"id": "optimize", "type": "action", "position": {"x": 100, "y": 300}, "data": {"action_type": "data_transform", "label": "Optimize for Platform"}},
            {"id": "schedule_check", "type": "condition", "position": {"x": 100, "y": 400}, "data": {"label": "Check Optimal Time"}},
            {"id": "schedule", "type": "action", "position": {"x": 200, "y": 500}, "data": {"action_type": "delay", "label": "Schedule Post"}},
            {"id": "post_now", "type": "action", "position": {"x": 0, "y": 500}, "data": {"action_type": "api_call", "label": "Post Immediately"}},
            {"id": "track", "type": "action", "position": {"x": 100, "y": 600}, "data": {"action_type": "api_call", "label": "Track Engagement"}},
            {"id": "end", "type": "end", "position": {"x": 100, "y": 700}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "generate_content"},
            {"id": "e2", "source": "generate_content", "target": "optimize"},
            {"id": "e3", "source": "optimize", "target": "schedule_check"},
            {"id": "e4", "source": "schedule_check", "target": "schedule", "data": {"condition": "schedule"}},
            {"id": "e5", "source": "schedule_check", "target": "post_now", "data": {"condition": "now"}},
            {"id": "e6", "source": "schedule", "target": "track"},
            {"id": "e7", "source": "post_now", "target": "track"},
            {"id": "e8", "source": "track", "target": "end"}
        ]
    }',
    '[
        {"name": "content_theme", "type": "string", "required": true, "description": "Theme or topic for the content"},
        {"name": "target_platforms", "type": "array", "required": true, "description": "Social media platforms to post to"},
        {"name": "brand_guidelines", "type": "object", "required": false, "description": "Brand voice and style guidelines"}
    ]',
    '[
        {"name": "posts_created", "type": "number", "description": "Number of posts successfully created"},
        {"name": "scheduled_posts", "type": "array", "description": "List of scheduled posts with times"},
        {"name": "engagement_baseline", "type": "object", "description": "Initial engagement metrics"}
    ]',
    0,
    0.0,
    true,
    false,
    NOW()
);

-- Templates start with 0 usage and 0 rating - these will grow as users actually use them
-- No fake updates needed - let real usage drive these metrics