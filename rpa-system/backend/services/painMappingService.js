/**
 * Pain Mapping Service
 * Transforms vague user pain points into actionable workflow configurations
 *
 * This service implements "Theory of Mind" for the AI Agent - it understands
 * that users describe problems, not solutions, and helps discover the real need.
 */

const logger = require('../utils/logger').createLogger('painMapping');

// Pain point patterns - detect when users are describing problems, not solutions
const PAIN_PATTERNS = [
  // Fatigue/frustration indicators
  { pattern: /tired of|sick of|hate|annoyed by|frustrated with/i, type: 'fatigue' },
  { pattern: /waste.*time|too much time|taking forever/i, type: 'time_waste' },
  { pattern: /repetitive|boring|manual|tedious/i, type: 'repetition' },
  { pattern: /copy.*paste|copying|copy data|moving data/i, type: 'data_copy' },
  { pattern: /every.*morning|Monday morning|daily|weekly|regularly/i, type: 'recurring_task' },
  { pattern: /forget|remember|remind me/i, type: 'memory' },
  { pattern: /miss|missing|didn't|forgot to/i, type: 'omission' },
  { pattern: /check.*manually|have to check|keep checking/i, type: 'monitoring' }
];

// Clarifying questions based on pain type
const DISCOVERY_QUESTIONS = {
  data_copy: [
    { question: 'Which apps or websites are you copying data between?', key: 'source_apps' },
    { question: 'Is this something you do daily, weekly, or just occasionally?', key: 'frequency' },
    { question: 'Do you need to log into any websites to get this data?', key: 'requires_login' }
  ],
  time_waste: [
    { question: 'What task is taking up your time?', key: 'task_description' },
    { question: 'How often do you do this?', key: 'frequency' },
    { question: 'Which tools or websites are involved?', key: 'tools_involved' }
  ],
  repetition: [
    { question: "What's the repetitive task you want to automate?", key: 'task_description' },
    { question: 'How often do you do this?', key: 'frequency' },
    { question: 'Does it involve multiple steps or just one?', key: 'complexity' }
  ],
  recurring_task: [
    { question: "What's the task you do every Monday morning (or regularly)?", key: 'task_description' },
    { question: 'Which apps or websites do you use for this?', key: 'apps_involved' },
    { question: 'Do you need to log into any websites?', key: 'requires_login' }
  ],
  monitoring: [
    { question: 'What are you checking or monitoring?', key: 'monitoring_target' },
    { question: 'How often do you need to check?', key: 'check_frequency' },
    { question: 'What should happen when something changes?', key: 'action_on_change' }
  ],
  memory: [
    { question: 'What do you want to be reminded about?', key: 'reminder_subject' },
    { question: 'When should you be reminded?', key: 'reminder_timing' },
    { question: 'How should you be notified (email, Slack, etc.)?', key: 'notification_method' }
  ],
  omission: [
    { question: 'What did you miss or forget to do?', key: 'missed_task' },
    { question: 'How often does this happen?', key: 'frequency' },
    { question: 'How can we prevent this from happening again?', key: 'prevention_method' }
  ],
  fatigue: [
    { question: "What's the task that's making you tired or frustrated?", key: 'fatiguing_task' },
    { question: 'Which apps or tools are involved?', key: 'tools_involved' },
    { question: 'How often do you do this?', key: 'frequency' }
  ]
};

// Default workflow settings for "just make it work" scenarios
const DEFAULT_WORKFLOW_SETTINGS = {
  schedule: {
    interval: '15', // minutes
    cron: '*/15 * * * *',
    description: 'Every 15 minutes'
  },
  timeout: 30000, // 30 seconds
  retry: {
    enabled: true,
    maxAttempts: 3,
    delay: 5000 // 5 seconds
  },
  logging: {
    level: 'info',
    enableTelemetry: true
  },
  mode: 'standard' // vs 'advanced'
};

/**
 * Detect if user input is a pain point (vague problem description) vs a solution request
 */
function detectPainPoint(userMessage) {
  const inputLower = userMessage.toLowerCase();

  // Check for explicit workflow creation keywords (not a pain point)
  const solutionKeywords = ['create workflow', 'build workflow', 'automate', 'set up', 'make a workflow'];
  if (solutionKeywords.some(keyword => inputLower.includes(keyword))) {
    return { isPainPoint: false, confidence: 1.0 };
  }

  // Check for pain patterns
  let matchedPatterns = [];
  for (const painPattern of PAIN_PATTERNS) {
    if (painPattern.pattern.test(userMessage)) {
      matchedPatterns.push({
        type: painPattern.type,
        confidence: 0.8
      });
    }
  }

  // Also check for vague descriptions (short, no technical terms)
  const hasTechnicalTerms = /\b(api|json|http|endpoint|selector|css|cron|workflow|automation)\b/i.test(userMessage);
  const isVague = userMessage.length < 100 && !hasTechnicalTerms && matchedPatterns.length > 0;

  return {
    isPainPoint: matchedPatterns.length > 0 || isVague,
    confidence: matchedPatterns.length > 0 ? 0.9 : (isVague ? 0.6 : 0),
    painTypes: matchedPatterns.map(p => p.type),
    isVague
  };
}

/**
 * Generate clarifying questions based on detected pain points
 */
function generateClarifyingQuestions(painDetection, conversationContext = {}) {
  const { painTypes, isVague } = painDetection;

  // If we already have answers from context, skip those questions
  const answeredKeys = new Set(Object.keys(conversationContext.discoveredInfo || {}));

  // Collect questions from all relevant pain types
  const allQuestions = [];
  const questionKeys = new Set();

  for (const painType of painTypes || []) {
    const questions = DISCOVERY_QUESTIONS[painType] || [];
    for (const q of questions) {
      if (!answeredKeys.has(q.key) && !questionKeys.has(q.key)) {
        allQuestions.push(q);
        questionKeys.add(q.key);
      }
    }
  }

  // If vague but no specific pain type, ask generic questions
  if (isVague && allQuestions.length === 0) {
    allQuestions.push(
      { question: 'Which apps or websites are involved?', key: 'apps_involved' },
      { question: 'Is this something you do regularly (daily, weekly) or just occasionally?', key: 'frequency' },
      { question: 'Do you need to log into any websites?', key: 'requires_login' }
    );
  }

  // Prioritize: ask 1-2 most important questions first
  return allQuestions.slice(0, 2);
}

/**
 * Extract discovered information from conversation context
 */
function extractDiscoveredInfo(conversationContext) {
  const messages = conversationContext.previousMessages || [];
  const discoveredInfo = {};

  // Look for answers in recent messages
  for (const msg of messages.slice(-6)) { // Last 6 messages
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();

      // Extract frequency
      if (/daily|every day|each day/i.test(content)) {
        discoveredInfo.frequency = 'daily';
      } else if (/weekly|every week|each week/i.test(content)) {
        discoveredInfo.frequency = 'weekly';
      } else if (/hourly|every hour/i.test(content)) {
        discoveredInfo.frequency = 'hourly';
      } else if (/monthly|every month/i.test(content)) {
        discoveredInfo.frequency = 'monthly';
      }

      // Extract apps
      const appKeywords = ['slack', 'gmail', 'sheets', 'google sheets', 'excel', 'notion', 'trello', 'asana', 'hubspot', 'salesforce'];
      for (const app of appKeywords) {
        if (content.includes(app)) {
          discoveredInfo.apps_involved = discoveredInfo.apps_involved || [];
          if (!discoveredInfo.apps_involved.includes(app)) {
            discoveredInfo.apps_involved.push(app);
          }
        }
      }

      // Extract login requirement
      if (/login|log in|password|credentials|sign in/i.test(content)) {
        discoveredInfo.requires_login = true;
      }

      // Extract source/target
      if (/from.*to|copy.*to|move.*to/i.test(content)) {
        const match = content.match(/(?:from|copy|move).*?(?:to|into)\s+(\w+)/i);
        if (match) {
          discoveredInfo.target_app = match[1];
        }
      }
    }
  }

  return discoveredInfo;
}

/**
 * Match user's pain description to existing templates
 */
async function matchTemplatesToPain(painDescription, discoveredInfo = {}) {
  // Build search query from pain description + discovered info
  const searchTerms = [
    painDescription,
    ...(discoveredInfo.apps_involved || []),
    discoveredInfo.frequency,
    discoveredInfo.target_app
  ].filter(Boolean).join(' ');

  try {
    // Query templates via Supabase
    const supabase = require('../utils/supabase').getSupabase();

    if (!supabase) {
      logger.warn('Supabase not available for template matching');
      return { matches: [], success: false };
    }

    // Search templates by name, description, and tags
    const { data: templates, error } = await supabase
      .from('workflow_templates')
      .select('id, name, description, category, tags, popularity_score, usage_count')
      .eq('status', 'approved')
      .eq('is_public', true)
      .or(`name.ilike.%${searchTerms}%,description.ilike.%${searchTerms}%,tags.cs.{${searchTerms}}`)
      .order('popularity_score', { ascending: false })
      .limit(5);

    if (error) {
      logger.error('Template search error:', error);
      return { matches: [], success: false };
    }

    // Score and rank templates
    const scoredTemplates = (templates || []).map(template => {
      let score = 0;

      // Boost score for app matches
      const templateText = `${template.name} ${template.description} ${(template.tags || []).join(' ')}`.toLowerCase();
      if (discoveredInfo.apps_involved) {
        for (const app of discoveredInfo.apps_involved) {
          if (templateText.includes(app.toLowerCase())) {
            score += 10;
          }
        }
      }

      // Boost for frequency matches
      if (discoveredInfo.frequency && templateText.includes(discoveredInfo.frequency)) {
        score += 5;
      }

      // Add popularity score
      score += (template.popularity_score || 0) / 10;

      return { ...template, matchScore: score };
    });

    // Sort by match score and return top 3
    scoredTemplates.sort((a, b) => b.matchScore - a.matchScore);

    return {
      matches: scoredTemplates.slice(0, 3),
      success: true,
      searchQuery: searchTerms
    };

  } catch (error) {
    logger.error('Template matching error:', error);
    return { matches: [], success: false, error: error.message };
  }
}

/**
 * Generate a non-technical preview of what the workflow will do
 */
function generateWorkflowPreview(workflowConfig, discoveredInfo = {}) {
  const { name, description, nodes = [] } = workflowConfig;

  // Build a simple, non-technical preview
  const steps = [];

  for (const node of nodes) {
    const stepType = node.stepType || node.type;
    const label = node.label || node.name || stepType;

    switch (stepType) {
      case 'web_scrape':
      case 'web_scraping':
        steps.push(`Check "${label}" and grab the information`);
        break;
      case 'api_request':
      case 'api_call':
        steps.push(`Get data from "${label}"`);
        break;
      case 'transform_data':
      case 'transform':
        steps.push('Format the data');
        break;
      case 'sheets_write':
      case 'sheets_append':
        steps.push('Save the data to Google Sheets');
        break;
      case 'send_email':
      case 'email':
        steps.push('Send an email');
        break;
      case 'condition':
      case 'if_else':
        steps.push('Check if something happened');
        break;
      case 'delay':
      case 'wait':
        steps.push('Wait a moment');
        break;
      default:
        steps.push(`Run "${label}"`);
    }
  }

  let preview = `I'm going to ${steps.join(', then ').toLowerCase()}.`;

  // Add scheduling info if available
  if (discoveredInfo.frequency) {
    const frequencyMap = {
      'daily': 'every day',
      'weekly': 'every week',
      'hourly': 'every hour',
      'monthly': 'every month'
    };
    preview += ` This will run ${frequencyMap[discoveredInfo.frequency] || discoveredInfo.frequency}.`;
  }

  return preview;
}

/**
 * Apply zero-instruction defaults to workflow configuration
 */
function applyDefaultSettings(workflowConfig, userRequestedDefaults = false) {
  if (!userRequestedDefaults) {
    return workflowConfig; // Only apply if user said "just make it work"
  }

  const enhanced = JSON.parse(JSON.stringify(workflowConfig)); // Deep clone

  // Apply default schedule if not specified
  if (!enhanced.schedule && DEFAULT_WORKFLOW_SETTINGS.schedule) {
    enhanced.schedule = DEFAULT_WORKFLOW_SETTINGS.schedule;
  }

  // Apply default timeout to web scraping steps
  if (enhanced.nodes) {
    enhanced.nodes = enhanced.nodes.map(node => {
      if ((node.stepType === 'web_scrape' || node.stepType === 'web_scraping') && !node.config?.timeout) {
        node.config = node.config || {};
        node.config.timeout = DEFAULT_WORKFLOW_SETTINGS.timeout;
      }
      return node;
    });
  }

  // Set default mode
  enhanced.mode = DEFAULT_WORKFLOW_SETTINGS.mode;

  return enhanced;
}

module.exports = {
  detectPainPoint,
  generateClarifyingQuestions,
  extractDiscoveredInfo,
  matchTemplatesToPain,
  generateWorkflowPreview,
  applyDefaultSettings,
  DEFAULT_WORKFLOW_SETTINGS
};
