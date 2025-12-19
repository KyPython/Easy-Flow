/**
 * AI Action Executor Service
 * 
 * Executes actions requested by the AI Agent. This turns the AI into a full
 * app copilot that can do anything the user can do via natural language.
 * 
 * Available Action Categories:
 * - TASKS: Create, run, list, delete tasks
 * - WORKFLOWS: Create, run, schedule, pause, list workflows
 * - AUTOMATIONS: One-off scrape, email, API calls
 * - ACCOUNT: Check status, usage, plan info
 * - SUPPORT: Contact support, report issues
 * 
 * OBSERVABILITY:
 * - All logs flow through structured logging with trace context
 * - Performance metrics tracked for each action
 * - Business metrics for usage analytics
 */

const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');

// Namespaced logger for AI Action Executor
const logger = createLogger('ai.executor');

// Import services for executing actions
let taskService, workflowService, emailService, scraperService;

// Lazy load services to avoid circular dependencies
function getTaskService() {
  if (!taskService) {
    try {
      taskService = require('./TaskService');
    } catch (e) {
      logger.warn('[AI Executor] TaskService not available');
    }
  }
  return taskService;
}

function getWorkflowService() {
  if (!workflowService) {
    try {
      workflowService = require('./WorkflowService');
    } catch (e) {
      logger.warn('[AI Executor] WorkflowService not available');
    }
  }
  return workflowService;
}

/**
 * Available actions the AI can execute
 * Each action has a schema that the AI uses to understand parameters
 */
const AVAILABLE_ACTIONS = {
  // ========== TASK ACTIONS ==========
  create_task: {
    name: 'create_task',
    description: 'Create a new one-off task for the user',
    category: 'tasks',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the task' },
        description: { type: 'string', description: 'What the task does' },
        task_type: { 
          type: 'string', 
          enum: ['web_scrape', 'api_call', 'email', 'data_transform'],
          description: 'Type of task to create'
        },
        config: { type: 'object', description: 'Task-specific configuration' }
      },
      required: ['name', 'task_type']
    },
    execute: createTask
  },

  run_task: {
    name: 'run_task',
    description: 'Execute an existing task immediately',
    category: 'tasks',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID of the task to run' },
        task_name: { type: 'string', description: 'Name of the task (if ID not known)' }
      }
    },
    execute: runTask
  },

  list_tasks: {
    name: 'list_tasks',
    description: 'List all tasks for the user',
    category: 'tasks',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'failed', 'all'] },
        limit: { type: 'number', description: 'Maximum number of tasks to return' }
      }
    },
    execute: listTasks
  },

  // ========== WORKFLOW ACTIONS ==========
  create_workflow: {
    name: 'create_workflow',
    description: 'Create a new workflow from the AI-generated configuration',
    category: 'workflows',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the workflow' },
        description: { type: 'string', description: 'What the workflow does' },
        nodes: { 
          type: 'array', 
          description: 'Workflow nodes configuration',
          items: { type: 'object' }
        },
        edges: { 
          type: 'array', 
          description: 'Connections between nodes',
          items: { type: 'object' }
        }
      },
      required: ['name', 'nodes']
    },
    execute: createWorkflow
  },

  run_workflow: {
    name: 'run_workflow',
    description: 'Execute an existing workflow immediately',
    category: 'workflows',
    parameters: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'ID of the workflow to run' },
        workflow_name: { type: 'string', description: 'Name of the workflow (if ID not known)' }
      }
    },
    execute: runWorkflow
  },

  list_workflows: {
    name: 'list_workflows',
    description: 'List all workflows for the user',
    category: 'workflows',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'draft', 'archived', 'all'] },
        limit: { type: 'number', description: 'Maximum number to return' }
      }
    },
    execute: listWorkflows
  },

  schedule_workflow: {
    name: 'schedule_workflow',
    description: 'Schedule a workflow to run at specific times',
    category: 'workflows',
    parameters: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'ID of the workflow' },
        workflow_name: { type: 'string', description: 'Name (if ID not known)' },
        schedule_type: { 
          type: 'string', 
          enum: ['once', 'daily', 'weekly', 'monthly', 'cron'],
          description: 'Type of schedule'
        },
        schedule_time: { type: 'string', description: 'When to run (ISO datetime or cron expression)' }
      },
      required: ['schedule_type']
    },
    execute: scheduleWorkflow
  },

  create_automated_workflow: {
    name: 'create_automated_workflow',
    description: 'Create a complete automated workflow from description and optionally schedule it. Use this when user wants to set up a recurring automation like "monitor X daily", "check Y every hour", "send weekly reports".',
    category: 'workflows',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the workflow' },
        description: { type: 'string', description: 'What the workflow should do' },
        trigger_type: { 
          type: 'string',
          enum: ['manual', 'hourly', 'daily', 'weekly', 'monthly'],
          description: 'How often to run: manual (one-time), hourly, daily, weekly, or monthly'
        },
        trigger_time: { type: 'string', description: 'When to run (e.g., "9:00 AM", "Monday 8:00 AM")' },
        notification_email: { type: 'string', description: 'Email to notify when workflow completes' },
        steps: { 
          type: 'array', 
          items: { type: 'object' },
          description: 'Workflow steps (e.g., scrape, transform, notify)' 
        }
      },
      required: ['name', 'description']
    },
    execute: createAutomatedWorkflow
  },

  // ========== ONE-OFF AUTOMATION ACTIONS ==========
  scrape_website: {
    name: 'scrape_website',
    description: 'Scrape data from a website. For best results, use specific product/category pages instead of homepages. Example: use "apple.com/shop/buy-mac" not just "apple.com".',
    category: 'automations',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to scrape - use specific pages for better results' },
        selectors: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'CSS selectors to extract (e.g., ".price", "#title")'
        },
        wait_for: { type: 'string', description: 'CSS selector to wait for before scraping' },
        timeout: { type: 'number', description: 'Timeout in seconds (default 30)' }
      },
      required: ['url']
    },
    execute: scrapeWebsite
  },

  send_email: {
    name: 'send_email',
    description: 'Send an email immediately (one-off)',
    category: 'automations',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (can include HTML)' },
        is_html: { type: 'boolean', description: 'Whether body is HTML' }
      },
      required: ['to', 'subject', 'body']
    },
    execute: sendEmail
  },

  make_api_call: {
    name: 'make_api_call',
    description: 'Make an API request immediately (one-off)',
    category: 'automations',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'API endpoint URL' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'object', description: 'Request body (for POST/PUT)' }
      },
      required: ['url']
    },
    execute: makeApiCall
  },

  // ========== ACCOUNT & STATUS ACTIONS ==========
  get_account_status: {
    name: 'get_account_status',
    description: 'Get user account status, plan info, and usage',
    category: 'account',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: getAccountStatus
  },

  get_execution_history: {
    name: 'get_execution_history',
    description: 'Get history of workflow/task executions',
    category: 'account',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of results (default 10)' },
        status: { type: 'string', enum: ['success', 'failed', 'running', 'all'] }
      }
    },
    execute: getExecutionHistory
  },

  // ========== SUPPORT ACTIONS ==========
  contact_support: {
    name: 'contact_support',
    description: 'Send a message to support or open mailto',
    category: 'support',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Support request subject' },
        message: { type: 'string', description: 'Support request message' },
        open_mailto: { type: 'boolean', description: 'If true, return mailto link instead of sending' }
      },
      required: ['subject', 'message']
    },
    execute: contactSupport
  }
};

// ============================================================================
// ACTION IMPLEMENTATIONS
// ============================================================================

async function createTask(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;
  const actionLogger = logger.withOperation('ai.action.create_task', { userId });

  try {
    const taskData = {
      user_id: userId,
      name: params.name,
      description: params.description || '',
      task_type: params.task_type,
      config: params.config || {},
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) throw error;

    actionLogger.info('Task created', {
      taskId: data.id,
      taskType: params.task_type,
      database: { operation: 'insert', table: 'tasks' }
    });

    return {
      success: true,
      message: `✅ Created task "${params.name}"`,
      data: {
        task_id: data.id,
        name: data.name,
        type: data.task_type
      }
    };
  } catch (error) {
    actionLogger.error('Create task failed', error, {
      taskName: params.name,
      taskType: params.task_type
    });
    return { success: false, error: error.message };
  }
}

async function runTask(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    // Find the task
    let query = supabase.from('tasks').select('*').eq('user_id', userId);
    
    if (params.task_id) {
      query = query.eq('id', params.task_id);
    } else if (params.task_name) {
      query = query.ilike('name', `%${params.task_name}%`);
    } else {
      return { success: false, error: 'Please specify task_id or task_name' };
    }

    const { data: tasks, error } = await query.limit(1);
    if (error) throw error;
    if (!tasks || tasks.length === 0) {
      return { success: false, error: 'Task not found' };
    }

    const task = tasks[0];

    // Execute based on task type
    let result;
    switch (task.task_type) {
      case 'web_scrape':
        result = await scrapeWebsite(task.config, context);
        break;
      case 'api_call':
        result = await makeApiCall(task.config, context);
        break;
      case 'email':
        result = await sendEmail(task.config, context);
        break;
      default:
        result = { success: false, error: `Unknown task type: ${task.task_type}` };
    }

    // Log execution
    await supabase.from('task_executions').insert({
      task_id: task.id,
      user_id: userId,
      status: result.success ? 'success' : 'failed',
      result: result,
      executed_at: new Date().toISOString()
    });

    return {
      success: result.success,
      message: result.success 
        ? `✅ Task "${task.name}" executed successfully` 
        : `❌ Task failed: ${result.error}`,
      data: result.data
    };
  } catch (error) {
    logger.error('[AI Executor] Run task failed:', error);
    return { success: false, error: error.message };
  }
}

async function listTasks(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    let query = supabase
      .from('tasks')
      .select('id, name, task_type, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params.limit) {
      query = query.limit(params.limit);
    } else {
      query = query.limit(10);
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      message: `Found ${data.length} tasks`,
      data: {
        tasks: data,
        count: data.length
      }
    };
  } catch (error) {
    logger.error('[AI Executor] List tasks failed:', error);
    return { success: false, error: error.message };
  }
}

async function createWorkflow(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  // Validate userId is a real UUID (not "anonymous")
  if (!userId || userId === 'anonymous' || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return {
      success: false,
      error: 'Authentication required',
      message: 'You need to be logged in to create workflows. Please sign in and try again! 😊'
    };
  }

  try {
    const workflowData = {
      user_id: userId,
      name: params.name,
      description: params.description || '',
      canvas_config: {
        nodes: params.nodes || [],
        edges: params.edges || [],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      status: 'draft',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `✅ Created workflow "${params.name}"`,
      data: {
        workflow_id: data.id,
        name: data.name,
        status: data.status
      }
    };
  } catch (error) {
    logger.error('[AI Executor] Create workflow failed:', error);
    return { success: false, error: error.message };
  }
}

async function runWorkflow(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    // Find the workflow
    let query = supabase.from('workflows').select('*').eq('user_id', userId);
    
    if (params.workflow_id) {
      query = query.eq('id', params.workflow_id);
    } else if (params.workflow_name) {
      query = query.ilike('name', `%${params.workflow_name}%`);
    } else {
      return { success: false, error: 'Please specify workflow_id or workflow_name' };
    }

    const { data: workflows, error } = await query.limit(1);
    if (error) throw error;
    if (!workflows || workflows.length === 0) {
      return { success: false, error: 'Workflow not found' };
    }

    const workflow = workflows[0];

    // Try to use the workflow executor service
    const workflowExecutor = getWorkflowService();
    if (workflowExecutor && workflowExecutor.executeWorkflow) {
      const result = await workflowExecutor.executeWorkflow(workflow.id, userId);
      return {
        success: true,
        message: `✅ Workflow "${workflow.name}" started`,
        data: {
          execution_id: result.executionId,
          status: 'running'
        }
      };
    }

    // Fallback: Just mark as triggered
    return {
      success: true,
      message: `✅ Workflow "${workflow.name}" triggered (execution in progress)`,
      data: {
        workflow_id: workflow.id,
        name: workflow.name
      }
    };
  } catch (error) {
    logger.error('[AI Executor] Run workflow failed:', error);
    return { success: false, error: error.message };
  }
}

async function listWorkflows(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    let query = supabase
      .from('workflows')
      .select('id, name, description, status, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    query = query.limit(params.limit || 10);

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      message: `Found ${data.length} workflows`,
      data: {
        workflows: data,
        count: data.length
      }
    };
  } catch (error) {
    logger.error('[AI Executor] List workflows failed:', error);
    return { success: false, error: error.message };
  }
}

async function scheduleWorkflow(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    // Find the workflow first
    let workflowId = params.workflow_id;
    if (!workflowId && params.workflow_name) {
      const { data } = await supabase
        .from('workflows')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', `%${params.workflow_name}%`)
        .limit(1);
      
      if (data && data.length > 0) {
        workflowId = data[0].id;
      }
    }

    if (!workflowId) {
      return { success: false, error: 'Workflow not found' };
    }

    // Create schedule
    const scheduleData = {
      workflow_id: workflowId,
      user_id: userId,
      schedule_type: params.schedule_type,
      schedule_config: {
        time: params.schedule_time,
        timezone: context.timezone || 'UTC'
      },
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('workflow_schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `✅ Scheduled workflow to run ${params.schedule_type}`,
      data: {
        schedule_id: data.id,
        next_run: params.schedule_time
      }
    };
  } catch (error) {
    logger.error('[AI Executor] Schedule workflow failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a complete automated workflow - generates, saves, and schedules in one action
 */
async function createAutomatedWorkflow(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;
  const startTime = Date.now();

  const actionLogger = logger.withOperation('ai.action.create_automated_workflow', { 
    name: params.name,
    trigger_type: params.trigger_type,
    userId
  });

  // Validate userId is a real UUID (not "anonymous")
  if (!userId || userId === 'anonymous' || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return {
      success: false,
      error: 'Authentication required',
      message: 'You need to be logged in to create workflows. Please sign in and try again! 😊'
    };
  }

  try {
    actionLogger.info('Creating automated workflow', { 
      description: params.description,
      trigger_type: params.trigger_type 
    });

    // Step 1: Generate fully configured workflow nodes using AI
    const { nodes, edges } = await generateFullyConfiguredWorkflow(params, context);

    // Step 2: Create the workflow in database
    const workflowData = {
      user_id: userId,
      name: params.name,
      description: params.description || '',
      canvas_config: {
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      status: 'active',
      created_at: new Date().toISOString()
    };

    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (workflowError) {
      throw new Error(`Failed to save workflow: ${workflowError.message}`);
    }

    actionLogger.info('Workflow saved', { workflowId: workflow.id });

    // Step 3: Schedule if not manual
    let scheduleInfo = null;
    if (params.trigger_type && params.trigger_type !== 'manual') {
      const scheduleData = {
        workflow_id: workflow.id,
        user_id: userId,
        schedule_type: params.trigger_type,
        schedule_config: {
          time: params.trigger_time || '09:00',
          timezone: context.timezone || 'UTC',
          notification_email: params.notification_email || context.userEmail
        },
        status: 'active',
        created_at: new Date().toISOString()
      };

      const { data: schedule, error: scheduleError } = await supabase
        .from('workflow_schedules')
        .insert(scheduleData)
        .select()
        .single();

      if (scheduleError) {
        actionLogger.warn('Failed to schedule workflow', { error: scheduleError.message });
      } else {
        scheduleInfo = {
          schedule_id: schedule.id,
          frequency: params.trigger_type,
          time: params.trigger_time || '9:00 AM'
        };
      }
    }

    const duration = Date.now() - startTime;
    actionLogger.performance('ai.workflow.automated_creation', duration, {
      category: 'workflow',
      success: true,
      hasSchedule: !!scheduleInfo
    });

    // Build friendly response
    let message = `✅ Created your automation "${params.name}"!`;
    if (scheduleInfo) {
      const frequencyText = {
        'hourly': 'every hour',
        'daily': `every day at ${scheduleInfo.time}`,
        'weekly': `every week on ${params.trigger_time || 'Monday at 9:00 AM'}`,
        'monthly': `once a month on the ${params.trigger_time || '1st at 9:00 AM'}`
      };
      message += `\n\n⏰ It will run ${frequencyText[params.trigger_type] || params.trigger_type}.`;
    }
    message += `\n\n🚀 Taking you to your workflows now...`;

    return {
      success: true,
      message,
      data: {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        steps_count: nodes.length,
        schedule: scheduleInfo
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    actionLogger.error('Failed to create automated workflow', error, { duration });
    return { 
      success: false, 
      error: error.message,
      message: `Sorry, I couldn't create that automation. ${error.message}`
    };
  }
}

/**
 * Generate fully configured workflow using AI to extract all details
 */
async function generateFullyConfiguredWorkflow(params, context) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const description = params.description || '';
  const fullPrompt = `${description}

Workflow name: ${params.name}
Trigger: ${params.trigger_type || 'manual'}
Notification email: ${params.notification_email || context.userEmail || 'user email'}

Extract ALL configuration details from this description and create a complete workflow with fully configured steps. For each step, provide:
- Complete configuration with all required fields
- URLs, email addresses, price thresholds, selectors, etc. extracted from the description
- All steps must be ready to run without additional configuration

Return a JSON object with this structure:
{
  "nodes": [
    {
      "id": "start-1",
      "stepType": "trigger",
      "label": "Start",
      "position": {"x": 100, "y": 100},
      "config": {"trigger_type": "${params.trigger_type || 'manual'}"},
      "isConfigured": true
    },
    {
      "id": "scrape-1",
      "stepType": "web_scrape",
      "actionType": "web_scrape",
      "label": "Scrape Website",
      "position": {"x": 100, "y": 200},
      "config": {
        "url": "EXTRACTED_URL_FROM_DESCRIPTION",
        "selectors": ["EXTRACT_SELECTORS_IF_MENTIONED"],
        "timeout": 30,
        "retries": {"maxAttempts": 3, "baseMs": 300}
      },
      "isConfigured": true
    },
    {
      "id": "email-1",
      "stepType": "email",
      "actionType": "email",
      "label": "Send Email",
      "position": {"x": 100, "y": 300},
      "config": {
        "to": ["EXTRACTED_EMAIL_OR_USER_EMAIL"],
        "subject": "EXTRACTED_OR_GENERATED_SUBJECT",
        "template": "EXTRACTED_OR_GENERATED_BODY"
      },
      "isConfigured": true
    }
  ],
  "edges": [
    {"source": "start-1", "target": "scrape-1"},
    {"source": "scrape-1", "target": "email-1"}
  ]
}

IMPORTANT:
- Extract URLs from the description (e.g., "amazon.com" → "https://amazon.com")
- Extract price thresholds (e.g., "below $50" → use in condition step)
- Extract email addresses or use notification_email
- For price monitoring: add a condition step to check if price < threshold
- For email: extract subject and body from description
- ALL steps must have isConfigured: true
- ALL action steps must have actionType set
- ALL required config fields must be filled`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a workflow configuration expert. Extract all details from user descriptions and create complete, ready-to-run workflow configurations. Always set isConfigured: true for all steps and fill in all required configuration fields.'
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent configuration
      response_format: { type: 'json_object' }
    });

    const response = JSON.parse(completion.choices[0].message.content);
    
    // Ensure all nodes have proper structure
    const nodes = (response.nodes || []).map((node, index) => ({
      id: node.id || `node-${index}-${Date.now()}`,
      type: node.stepType === 'trigger' ? 'trigger' : node.stepType === 'end' ? 'end' : 'customStep',
      position: node.position || { x: 100, y: 100 + (index * 150) },
      data: {
        label: node.label || 'Step',
        stepType: node.stepType,
        actionType: node.actionType || (node.stepType !== 'start' && node.stepType !== 'end' && node.stepType !== 'trigger' ? node.stepType : null),
        config: node.config || {},
        isConfigured: node.isConfigured !== false // Default to true if not specified
      }
    }));

    // Ensure all edges have proper structure
    const edges = (response.edges || []).map((edge, index) => ({
      id: edge.id || `edge-${index}-${Date.now()}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true
    }));

    // Validate and fix configurations
    nodes.forEach(node => {
      const { stepType, config } = node.data;
      
      // Ensure required fields are present based on step type
      if (stepType === 'web_scrape') {
        if (!config.url) {
          // Try to extract URL from description
          const urlMatch = description.match(/https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-z]{2,}/i);
          config.url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : '';
        }
        if (!config.selectors) config.selectors = [];
        if (!config.timeout) config.timeout = 30;
        if (!config.retries) config.retries = { maxAttempts: 3, baseMs: 300 };
        node.data.isConfigured = !!(config.url && config.url.trim());
      } else if (stepType === 'api_call') {
        if (!config.url) config.url = '';
        if (!config.method) config.method = 'GET';
        if (!config.headers) config.headers = {};
        if (!config.timeout) config.timeout = 30;
        node.data.isConfigured = !!(config.url && config.url.trim() && config.method);
      } else if (stepType === 'email') {
        // Ensure to is always an array
        if (!config.to) {
          config.to = params.notification_email ? [params.notification_email] : (context.userEmail ? [context.userEmail] : ['{{user.email}}']);
        } else if (typeof config.to === 'string') {
          config.to = [config.to];
        } else if (!Array.isArray(config.to)) {
          // Handle any other non-array types
          config.to = [String(config.to)];
        }
        if (!config.subject) {
          // Generate subject from description
          config.subject = `Update: ${params.name}`;
        }
        if (!config.template && !config.body) {
          config.template = 'Your automation has completed. Results: {{data}}';
        }
        node.data.isConfigured = !!(config.to && config.to.length > 0 && config.subject && config.subject.trim());
      } else if (stepType === 'condition') {
        if (!config.conditions) config.conditions = [];
        if (!config.operator) config.operator = 'AND';
        node.data.isConfigured = !!(config.conditions && config.conditions.length > 0);
      } else if (stepType === 'trigger' || stepType === 'start') {
        node.data.isConfigured = true; // Start/trigger nodes are always configured
      } else if (stepType === 'end') {
        node.data.isConfigured = true; // End nodes are always configured
      } else {
        // For other step types, mark as configured if config has any keys
        node.data.isConfigured = Object.keys(config || {}).length > 0;
      }
    });

    return { nodes, edges };
  } catch (error) {
    logger.warn('AI workflow generation failed, falling back to simple generation', { error: error.message });
    // Fallback to simple generation
    const nodes = generateWorkflowNodes(params);
    const edges = generateWorkflowEdges(nodes);
    return { nodes, edges };
  }
}

/**
 * Generate workflow nodes from parameters (fallback method)
 */
function generateWorkflowNodes(params) {
  const nodes = [];
  const description = (params.description || '').toLowerCase();
  
  // Start node
  nodes.push({
    id: 'start-1',
    type: 'trigger',
    position: { x: 100, y: 100 },
    data: {
      label: params.trigger_type === 'manual' ? 'Manual Start' : `${params.trigger_type} Trigger`,
      stepType: 'trigger',
      config: {
        trigger_type: params.trigger_type || 'manual',
        time: params.trigger_time
      },
      isConfigured: true
    }
  });

  let yPos = 200;

  // Detect what kind of workflow based on description
  if (description.includes('scrape') || description.includes('monitor') || description.includes('check') || description.includes('website') || description.includes('price')) {
    // Extract URL if mentioned
    const urlMatch = params.description.match(/https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-z]{2,}/i);
    const url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : '';
    
    // Extract price threshold if mentioned
    const priceMatch = params.description.match(/\$?(\d+)/);
    const priceThreshold = priceMatch ? parseFloat(priceMatch[1]) : null;
    
    nodes.push({
      id: 'scrape-1',
      type: 'customStep',
      position: { x: 100, y: yPos },
      data: {
        label: 'Check Website',
        stepType: 'web_scrape',
        actionType: 'web_scrape',
        config: {
          url: url || 'https://example.com',
          selectors: [],
          timeout: 30,
          retries: { maxAttempts: 3, baseMs: 300 }
        },
        isConfigured: !!(url && url.trim())
      }
    });
    yPos += 150;
    
    // Add condition step if price threshold is mentioned
    if (priceThreshold) {
      nodes.push({
        id: 'condition-1',
        type: 'customStep',
        position: { x: 100, y: yPos },
        data: {
          label: 'Check Price',
          stepType: 'condition',
          config: {
            conditions: [
              {
                field: 'price',
                operator: '<',
                value: priceThreshold
              }
            ],
            operator: 'AND'
          },
          isConfigured: true
        }
      });
      yPos += 150;
    }
  }

  if (description.includes('api') || description.includes('data') || description.includes('fetch')) {
    // Extract API URL if mentioned
    const apiUrlMatch = params.description.match(/https?:\/\/[^\s]+/i);
    const apiUrl = apiUrlMatch ? apiUrlMatch[0] : '';
    
    nodes.push({
      id: 'api-1',
      type: 'customStep',
      position: { x: 100, y: yPos },
      data: {
        label: 'Fetch Data',
        stepType: 'api_call',
        actionType: 'api_call',
        config: {
          method: 'GET',
          url: apiUrl,
          headers: {},
          timeout: 30,
          retries: { maxAttempts: 3, baseMs: 300 }
        },
        isConfigured: !!(apiUrl && apiUrl.trim())
      }
    });
    yPos += 150;
  }

  if (description.includes('save') || description.includes('store') || description.includes('sheet')) {
    nodes.push({
      id: 'save-1',
      type: 'customStep',
      position: { x: 100, y: yPos },
      data: {
        label: 'Save Data',
        stepType: 'data_storage',
        actionType: 'data_storage',
        config: {},
        isConfigured: false
      }
    });
    yPos += 150;
  }

  // Add notification step if mentioned
  if (description.includes('alert') || description.includes('notify') || description.includes('email') || description.includes('tell me') || description.includes('emails me')) {
    // Extract email from description or use notification_email
    const emailMatch = params.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    const email = emailMatch ? emailMatch[1] : (params.notification_email || '{{user.email}}');
    
    // Generate subject from description
    let subject = `Update: ${params.name}`;
    if (description.includes('price')) {
      subject = 'Price Alert';
    } else if (description.includes('drop') || description.includes('below')) {
      subject = 'Price Drop Alert';
    }
    
    // Ensure email is always an array
    const emailArray = Array.isArray(email) ? email : (email ? [email] : ['{{user.email}}']);
    
    nodes.push({
      id: 'notify-1',
      type: 'customStep',
      position: { x: 100, y: yPos },
      data: {
        label: 'Send Notification',
        stepType: 'email',
        actionType: 'email',
        config: {
          to: emailArray,
          subject: subject,
          template: description.includes('price') 
            ? 'The price has dropped below your threshold! Current price: {{price}}'
            : 'Your automation has completed. Here are the results: {{data}}'
        },
        isConfigured: !!(emailArray.length > 0 && subject && subject.trim())
      }
    });
    yPos += 150;
  }

  // End node
  nodes.push({
    id: 'end-1',
    type: 'end',
    position: { x: 100, y: yPos },
    data: {
      label: 'Complete',
      stepType: 'end',
      isConfigured: true
    }
  });

  return nodes;
}

/**
 * Generate edges connecting workflow nodes
 */
function generateWorkflowEdges(nodes) {
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'smoothstep'
    });
  }
  return edges;
}

async function scrapeWebsite(params, context) {
  const axios = require('axios');
  const startTime = Date.now();
  const actionLogger = logger.withOperation('ai.action.scrape_website', { 
    url: params.url,
    userId: context?.userId 
  });

  try {
    // Call the automation service
    const automationUrl = process.env.AUTOMATION_URL || 'http://127.0.0.1:7070';
    
    actionLogger.debug('Calling automation service', { automationUrl });
    
    const response = await axios.post(`${automationUrl}/scrape`, {
      url: params.url,
      selectors: params.selectors || [],
      wait_for: params.wait_for,
      timeout: params.timeout || 30
    }, {
      timeout: (params.timeout || 30) * 1000 + 5000
    });

    const duration = Date.now() - startTime;
    actionLogger.performance('ai.scrape.automation', duration, {
      category: 'external_service',
      url: params.url,
      selectorsCount: params.selectors?.length || 0
    });

    return {
      success: true,
      message: `✅ Scraped ${params.url}`,
      data: response.data
    };
  } catch (error) {
    actionLogger.warn('Automation service unavailable, falling back to basic fetch', {
      error: error.message,
      automationUrl: process.env.AUTOMATION_URL || 'http://127.0.0.1:7070'
    });

    // Fallback: Try a simple fetch if automation service unavailable
    try {
      const response = await axios.get(params.url, { timeout: 30000 });
      const duration = Date.now() - startTime;
      
      actionLogger.performance('ai.scrape.fallback', duration, {
        category: 'http_request',
        url: params.url,
        status: response.status
      });

      return {
        success: true,
        message: `✅ Fetched ${params.url} (basic mode - no JavaScript rendering)`,
        data: {
          url: params.url,
          status: response.status,
          contentLength: response.data?.length || 0,
          note: 'Full scraping service unavailable, returned raw HTML'
        }
      };
    } catch (fetchError) {
      actionLogger.error('Scrape failed completely', fetchError, {
        url: params.url,
        originalError: error.message
      });
      return { success: false, error: `Failed to scrape: ${error.message}` };
    }
  }
}

async function sendEmail(params, context) {
  const startTime = Date.now();
  const actionLogger = logger.withOperation('ai.action.send_email', { 
    userId: context?.userId,
    recipient: params.to 
  });

  try {
    const sgMail = require('@sendgrid/mail');
    const sendgridKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@useeasyflow.com';

    if (!sendgridKey) {
      actionLogger.warn('SendGrid not configured, returning mailto fallback');
      return { 
        success: false, 
        error: 'Email service not configured',
        fallback: {
          type: 'mailto',
          link: `mailto:${params.to}?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.body)}`
        }
      };
    }

    sgMail.setApiKey(sendgridKey);

    const msg = {
      to: params.to,
      from: fromEmail,
      subject: params.subject,
      [params.is_html ? 'html' : 'text']: params.body
    };

    await sgMail.send(msg);
    const duration = Date.now() - startTime;

    actionLogger.performance('ai.email.sendgrid', duration, {
      category: 'external_service',
      recipient: params.to,
      isHtml: !!params.is_html
    });

    // Business metric for email tracking
    actionLogger.metric('ai.email.sent', 1, 'count', {
      userId: context?.userId,
      isHtml: !!params.is_html
    });

    actionLogger.info('Email sent successfully', {
      to: params.to,
      subject: params.subject?.slice(0, 50),
      duration
    });

    return {
      success: true,
      message: `✅ Email sent to ${params.to}`,
      data: {
        to: params.to,
        subject: params.subject
      }
    };
  } catch (error) {
    actionLogger.error('Send email failed', error, {
      recipient: params.to,
      subject: params.subject?.slice(0, 50)
    });
    return { success: false, error: error.message };
  }
}

async function makeApiCall(params, context) {
  const axios = require('axios');
  const { getTraceHeaders } = require('../middleware/traceContext');
  const startTime = Date.now();
  const actionLogger = logger.withOperation('ai.action.api_call', { 
    userId: context?.userId,
    method: params.method || 'GET',
    url: params.url 
  });

  try {
    // Propagate trace context to outbound requests
    const traceHeaders = getTraceHeaders();
    
    const config = {
      method: params.method || 'GET',
      url: params.url,
      headers: {
        ...traceHeaders,  // Trace context propagation
        ...params.headers
      },
      timeout: 30000
    };

    if (['POST', 'PUT', 'PATCH'].includes(config.method) && params.body) {
      config.data = params.body;
    }

    actionLogger.debug('Making API call', {
      method: config.method,
      url: config.url,
      hasBody: !!config.data
    });

    const response = await axios(config);
    const duration = Date.now() - startTime;

    actionLogger.performance('ai.api_call.external', duration, {
      category: 'http_request',
      method: config.method,
      status: response.status,
      url: config.url
    });

    actionLogger.info('API call successful', {
      method: config.method,
      url: config.url,
      status: response.status,
      duration
    });

    return {
      success: true,
      message: `✅ API call successful (${response.status})`,
      data: {
        status: response.status,
        headers: response.headers,
        data: response.data
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    actionLogger.error('API call failed', error, {
      method: params.method || 'GET',
      url: params.url,
      status: error.response?.status,
      duration
    });
    
    return { 
      success: false, 
      error: error.message,
      data: {
        status: error.response?.status,
        message: error.response?.data
      }
    };
  }
}

async function getAccountStatus(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Get counts
    const { count: workflowCount } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get recent executions count (this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: executionsThisMonth } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('started_at', startOfMonth.toISOString());

    return {
      success: true,
      message: 'Account status retrieved',
      data: {
        plan: profile?.plan || 'free',
        workflows: workflowCount || 0,
        tasks: taskCount || 0,
        executions_this_month: executionsThisMonth || 0,
        member_since: profile?.created_at
      }
    };
  } catch (error) {
    logger.error('[AI Executor] Get account status failed:', error);
    return { success: false, error: error.message };
  }
}

async function getExecutionHistory(params, context) {
  const supabase = getSupabase();
  const userId = context.userId;

  try {
    let query = supabase
      .from('workflow_executions')
      .select(`
        id,
        workflow_id,
        status,
        started_at,
        completed_at,
        workflows(name)
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    query = query.limit(params.limit || 10);

    const { data, error } = await query;
    if (error) throw error;

    return {
      success: true,
      message: `Found ${data.length} executions`,
      data: {
        executions: data.map(e => ({
          id: e.id,
          workflow: e.workflows?.name || 'Unknown',
          status: e.status,
          started: e.started_at,
          completed: e.completed_at
        })),
        count: data.length
      }
    };
  } catch (error) {
    logger.error('[AI Executor] Get history failed:', error);
    return { success: false, error: error.message };
  }
}

async function contactSupport(params, context) {
  const supportEmail = 'support@useeasyflow.com';

  if (params.open_mailto) {
    const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.message)}`;
    return {
      success: true,
      message: 'Opening email client...',
      data: {
        type: 'mailto',
        link: mailtoLink,
        instruction: 'Click the link to open your email client'
      }
    };
  }

  // Try to send via API
  try {
    const sgMail = require('@sendgrid/mail');
    const sendgridKey = process.env.SENDGRID_API_KEY;
    
    if (!sendgridKey) {
      // Return mailto fallback
      return {
        success: true,
        message: 'Email service not available - use this link instead',
        data: {
          type: 'mailto',
          link: `mailto:${supportEmail}?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.message)}`
        }
      };
    }

    sgMail.setApiKey(sendgridKey);
    
    await sgMail.send({
      to: supportEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@useeasyflow.com',
      replyTo: context.userEmail || undefined,
      subject: `[Support] ${params.subject}`,
      text: `From: ${context.userEmail || 'Unknown'}\nUser ID: ${context.userId || 'Unknown'}\n\n${params.message}`
    });

    return {
      success: true,
      message: '✅ Support request sent! We\'ll get back to you soon.',
      data: { sent: true }
    };
  } catch (error) {
    logger.error('[AI Executor] Contact support failed:', error);
    return { 
      success: false, 
      error: error.message,
      fallback: {
        type: 'mailto',
        link: `mailto:${supportEmail}?subject=${encodeURIComponent(params.subject)}&body=${encodeURIComponent(params.message)}`
      }
    };
  }
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

/**
 * Execute an action by name with given parameters
 * 
 * OBSERVABILITY: Full structured logging with performance tracking
 */
async function executeAction(actionName, params, context) {
  const startTime = Date.now();
  const action = AVAILABLE_ACTIONS[actionName];
  
  // Create user-scoped logger for this execution
  const execLogger = logger
    .withUser({ id: context.userId, email: context.userEmail })
    .withOperation('ai.action.execute', {
      actionName,
      category: action?.category || 'unknown'
    });
  
  if (!action) {
    execLogger.warn('Unknown action requested', {
      action: actionName,
      availableActions: Object.keys(AVAILABLE_ACTIONS).length
    });
    return {
      success: false,
      error: `Unknown action: ${actionName}`,
      available_actions: Object.keys(AVAILABLE_ACTIONS)
    };
  }

  execLogger.info('Executing AI action', {
    action: actionName,
    category: action.category,
    paramKeys: Object.keys(params || {})
  });

  try {
    const result = await action.execute(params, context);
    const duration = Date.now() - startTime;
    
    // Log performance metric
    execLogger.performance(`ai.action.${actionName}`, duration, {
      category: 'ai_action',
      actionCategory: action.category,
      success: result.success
    });
    
    // Log business metric for analytics
    execLogger.metric('ai.action.executed', 1, 'count', {
      action: actionName,
      category: action.category,
      success: result.success,
      duration
    });

    execLogger.info('AI action completed', {
      action: actionName,
      success: result.success,
      duration
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    execLogger.error('AI action failed', error, {
      action: actionName,
      category: action.category,
      duration
    });

    // Track failed actions
    execLogger.metric('ai.action.failed', 1, 'count', {
      action: actionName,
      category: action.category,
      errorType: error.constructor.name
    });

    return {
      success: false,
      error: `Action failed: ${error.message}`
    };
  }
}

/**
 * Get all available actions (for AI to understand what it can do)
 */
function getAvailableActions() {
  return Object.entries(AVAILABLE_ACTIONS).map(([name, action]) => ({
    name,
    description: action.description,
    category: action.category,
    parameters: action.parameters
  }));
}

/**
 * Get actions formatted for OpenAI function calling
 */
function getActionsAsTools() {
  return Object.entries(AVAILABLE_ACTIONS).map(([name, action]) => ({
    type: 'function',
    function: {
      name,
      description: action.description,
      parameters: action.parameters
    }
  }));
}

module.exports = {
  executeAction,
  getAvailableActions,
  getActionsAsTools,
  AVAILABLE_ACTIONS
};

