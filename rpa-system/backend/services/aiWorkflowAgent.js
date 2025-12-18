/**
 * AI Workflow Agent Service
 * 
 * Converts natural language descriptions into executable workflow configurations.
 * Uses OpenAI GPT-4 to understand user intent and generate workflow nodes/edges.
 * 
 * POWERED BY RAG-NODE-TS:
 * - Uses your rag-node-ts RAG service for knowledge retrieval
 * - All app knowledge is stored in Pinecone via your RAG SaaS
 * - Continuous learning through the RAG service
 * 
 * OBSERVABILITY:
 * - All logs flow through structured logging with trace context
 * - Token usage metrics tracked for cost monitoring
 * - Performance metrics for AI response times
 * - Business metrics for usage analytics
 */

const OpenAI = require('openai');
const { createLogger } = require('../middleware/structuredLogging');
const ragClient = require('./ragClient');

// Namespaced logger for AI Workflow Agent
const logger = createLogger('ai.agent');

// Lazy-initialize OpenAI client (only when first needed, not at module load)
let _openaiClient = null;
function getOpenAI() {
  if (!_openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn('OpenAI API key not configured - AI features will be limited');
      return null;
    }
    _openaiClient = new OpenAI({ apiKey });
  }
  return _openaiClient;
}

// Workflow step definitions for the AI to understand
const WORKFLOW_STEPS = {
  start: {
    id: 'start',
    label: 'Start',
    description: 'Entry point of the workflow',
    icon: '🎬',
    configSchema: {}
  },
  web_scrape: {
    id: 'web_scrape',
    label: 'Web Scraping',
    description: 'Extract data from websites using CSS selectors',
    icon: '🌐',
    configSchema: {
      url: { type: 'string', description: 'URL to scrape' },
      selectors: { type: 'array', description: 'CSS selectors to extract data' },
      timeout: { type: 'number', default: 30 }
    }
  },
  api_call: {
    id: 'api_call',
    label: 'API Request',
    description: 'Make HTTP requests to external APIs',
    icon: '🔗',
    configSchema: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
      url: { type: 'string', description: 'API endpoint URL' },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'object', description: 'Request body for POST/PUT' }
    }
  },
  data_transform: {
    id: 'data_transform',
    label: 'Transform Data',
    description: 'Process and transform data between steps',
    icon: '🔄',
    configSchema: {
      transformations: { type: 'array', description: 'List of transformations to apply' },
      output_format: { type: 'string', enum: ['json', 'csv', 'text'], default: 'json' }
    }
  },
  condition: {
    id: 'condition',
    label: 'Condition',
    description: 'Branch workflow based on conditions',
    icon: '❓',
    configSchema: {
      conditions: { type: 'array', description: 'Conditions to evaluate' },
      operator: { type: 'string', enum: ['AND', 'OR'], default: 'AND' }
    }
  },
  email: {
    id: 'email',
    label: 'Send Email',
    description: 'Send email notifications',
    icon: '📧',
    configSchema: {
      to: { type: 'array', description: 'Recipient email addresses' },
      subject: { type: 'string', description: 'Email subject line' },
      template: { type: 'string', description: 'Email body content' }
    }
  },
  file_upload: {
    id: 'file_upload',
    label: 'Upload File',
    description: 'Store files to cloud storage',
    icon: '📁',
    configSchema: {
      destination: { type: 'string', description: 'Storage destination path' },
      filename: { type: 'string', description: 'Name for the uploaded file' }
    }
  },
  delay: {
    id: 'delay',
    label: 'Delay',
    description: 'Wait for a specified duration',
    icon: '⏰',
    configSchema: {
      duration_seconds: { type: 'number', description: 'Wait time in seconds' }
    }
  },
  end: {
    id: 'end',
    label: 'End',
    description: 'Completion point of the workflow',
    icon: '🏁',
    configSchema: {
      success: { type: 'boolean', default: true },
      message: { type: 'string', description: 'Completion message' }
    }
  }
};

// System prompt for the AI agent
const SYSTEM_PROMPT = `You are an AI assistant that helps users create automation workflows using natural language.

You convert user descriptions into structured workflow configurations with the following step types:
${Object.values(WORKFLOW_STEPS).map(s => `- ${s.id}: ${s.description} ${s.icon}`).join('\n')}

IMPORTANT RULES:
1. Always start workflows with a "start" step
2. Always end workflows with an "end" step
3. Connect steps logically based on the user's intent
4. Position nodes visually (start at x:100, increment x by 250 for each subsequent step)
5. Use clear, descriptive labels for each step
6. Configure steps with realistic default values when not specified

When generating workflows, respond with a JSON object in this exact format:
{
  "workflow": {
    "name": "Descriptive workflow name",
    "description": "What this workflow does",
    "nodes": [
      {
        "id": "unique-node-id",
        "stepType": "step_type_from_list",
        "label": "Human readable label",
        "position": { "x": number, "y": number },
        "config": { /* step-specific configuration */ }
      }
    ],
    "edges": [
      {
        "id": "edge-id",
        "source": "source-node-id",
        "target": "target-node-id"
      }
    ]
  },
  "explanation": "Brief explanation of what this workflow does and how to customize it",
  "suggestions": ["Suggestion 1 for improvement", "Suggestion 2"]
}

Be helpful, creative, and ensure workflows are practical and executable.`;

/**
 * Parse natural language into a workflow configuration
 * Uses rag-node-ts RAG service for knowledge retrieval
 * 
 * OBSERVABILITY: Performance tracking for workflow generation
 */
async function parseNaturalLanguage(userMessage, context = {}) {
  const startTime = Date.now();
  const parseLogger = logger.withOperation('ai.agent.parseNaturalLanguage', {
    userId: context.userId
  });
  
  try {
    // 🧠 RAG: Get relevant knowledge from your rag-node-ts service
    let knowledgeContext = { context: '', sources: [], method: 'none' };
    
    try {
      const ragStartTime = Date.now();
      const ragResult = await ragClient.query(userMessage, { 
        topK: 5, 
        mode: 'retrieval',  // Just get passages, we'll generate our own answer
        useCache: true 
      });
      
      if (ragResult.success && ragResult.results?.length > 0) {
        knowledgeContext = {
          context: ragResult.results.map(r => r.text).join('\n\n'),
          sources: ragResult.results.map(r => r.metadata?.source || 'rag'),
          method: 'rag-node-ts'
        };
        
        parseLogger.info('Retrieved knowledge from rag-node-ts', {
          sources: knowledgeContext.sources?.slice(0, 3),
          contextLength: knowledgeContext.context?.length || 0,
          ragDuration: Date.now() - ragStartTime
        });
      }
    } catch (ragError) {
      parseLogger.warn('RAG service (rag-node-ts) unavailable', {
        error: ragError.message,
        ragUrl: ragClient.RAG_SERVICE_URL,
        hint: 'Start rag-node-ts service'
      });
    }

    // Build enhanced system prompt with app-specific knowledge
    const enhancedSystemPrompt = `${SYSTEM_PROMPT}

## EASY-FLOW APP KNOWLEDGE
The following is specific knowledge about the Easy-Flow app that you should use to provide accurate responses:

${knowledgeContext.context}

Use this knowledge to provide accurate, helpful responses about the Easy-Flow app features and capabilities.`;

    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
    ];

    // Add conversation context if provided
    if (context.previousMessages && context.previousMessages.length > 0) {
      messages.push(...context.previousMessages.slice(-6)); // Keep last 6 messages for context
    }

    messages.push({ role: 'user', content: userMessage });

    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent);

    // Validate and enhance the response
    const enhancedWorkflow = enhanceWorkflow(parsedResponse.workflow);

    return {
      success: true,
      workflow: enhancedWorkflow,
      explanation: parsedResponse.explanation,
      suggestions: parsedResponse.suggestions || [],
      usage: completion.usage,
      knowledgeSources: knowledgeContext.sources // Track what knowledge was used
    };

  } catch (error) {
    logger.error('[AI Agent] Error parsing natural language:', error);
    
    // Return a helpful error response
    return {
      success: false,
      error: error.message,
      suggestion: 'Try describing your workflow more specifically. For example: "Scrape prices from amazon.com every day and email me a report"'
    };
  }
}

/**
 * Enhance and validate the generated workflow
 */
function enhanceWorkflow(workflow) {
  if (!workflow || !workflow.nodes) {
    return null;
  }

  const timestamp = Date.now();
  
  // Ensure all nodes have proper IDs and positions
  const enhancedNodes = workflow.nodes.map((node, index) => ({
    id: node.id || `node-${node.stepType}-${timestamp}-${index}`,
    type: 'customStep',
    position: node.position || { x: 100 + (index * 250), y: 150 },
    data: {
      label: node.label || WORKFLOW_STEPS[node.stepType]?.label || 'Step',
      stepType: node.stepType,
      actionType: getActionType(node.stepType),
      config: node.config || {},
      isConfigured: Object.keys(node.config || {}).length > 0
    }
  }));

  // Ensure edges have proper IDs
  const enhancedEdges = (workflow.edges || []).map((edge, index) => ({
    id: edge.id || `edge-${timestamp}-${index}`,
    source: edge.source,
    target: edge.target,
    animated: true,
    style: {
      stroke: 'var(--color-primary-600)',
      strokeWidth: 2
    }
  }));

  return {
    name: workflow.name || 'AI Generated Workflow',
    description: workflow.description || 'Workflow created by AI assistant',
    nodes: enhancedNodes,
    edges: enhancedEdges,
    canvas_config: {
      nodes: enhancedNodes,
      edges: enhancedEdges,
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

/**
 * Get action type for a step
 */
function getActionType(stepType) {
  const nonActionTypes = ['start', 'end', 'condition'];
  return nonActionTypes.includes(stepType) ? null : stepType;
}

/**
 * Get smart suggestions based on partial input
 */
async function getSuggestions(partialInput) {
  const commonPatterns = [
    {
      trigger: ['scrape', 'extract', 'get data from'],
      suggestions: [
        'Scrape product prices from a website and save to spreadsheet',
        'Extract news headlines and send daily email digest',
        'Monitor competitor prices and alert when they change'
      ]
    },
    {
      trigger: ['email', 'send', 'notify'],
      suggestions: [
        'Send automated email reports every morning',
        'Email me when a website changes',
        'Send notifications when tasks complete'
      ]
    },
    {
      trigger: ['api', 'webhook', 'integrate'],
      suggestions: [
        'Sync data between two APIs automatically',
        'Post data to Slack when something happens',
        'Integrate with CRM and update records'
      ]
    },
    {
      trigger: ['schedule', 'daily', 'weekly', 'every'],
      suggestions: [
        'Run web scraping daily at 9 AM',
        'Weekly backup and email report',
        'Check inventory every hour'
      ]
    },
    {
      trigger: ['condition', 'if', 'when', 'check'],
      suggestions: [
        'If price drops below $50, send alert',
        'When stock is low, reorder automatically',
        'Check if website is down and notify team'
      ]
    }
  ];

  const inputLower = partialInput.toLowerCase();
  
  // Find matching patterns
  for (const pattern of commonPatterns) {
    if (pattern.trigger.some(t => inputLower.includes(t))) {
      return pattern.suggestions;
    }
  }

  // Default suggestions
  return [
    'Scrape data from a website and save it',
    'Send automated email notifications',
    'Connect two apps with an API workflow',
    'Monitor a website for changes',
    'Transform and process data automatically'
  ];
}

/**
 * Get conversation response for non-workflow queries
 * Uses rag-node-ts RAG service for knowledge-powered responses
 */
async function getConversationResponse(userMessage, context = {}) {
  try {
    // 🧠 RAG: Get answer from your rag-node-ts service
    let knowledgeContext = { context: '', sources: [], method: 'none' };
    let ragAnswer = null;
    
    try {
      const ragResult = await ragClient.query(userMessage, { 
        topK: 5, 
        mode: 'answer',  // Get full RAG answer with citations
        useCache: true 
      });
      
      if (ragResult.success) {
        // If RAG gives a good answer, we can use it or enhance it
        if (ragResult.answer && !ragResult.answer.includes('does not contain enough information')) {
          ragAnswer = ragResult.answer;
        }
        
        // Also extract context for our own answer generation
        if (ragResult.citations?.length > 0) {
          knowledgeContext = {
            context: ragResult.citations.map(c => c.text).join('\n\n'),
            sources: ragResult.citations.map(c => c.metadata?.source || 'rag'),
            method: 'rag-node-ts'
          };
        }
        
        logger.info('[AI Agent] Retrieved knowledge from rag-node-ts', {
          sources: knowledgeContext.sources?.slice(0, 3),
          hasAnswer: !!ragAnswer
        });
      }
    } catch (ragError) {
      logger.warn('[AI Agent] RAG service (rag-node-ts) unavailable', {
        error: ragError.message,
        hint: 'Make sure rag-node-ts is running at ' + ragClient.RAG_SERVICE_URL
      });
    }

    const enhancedSystemPrompt = `You are a helpful AI assistant for an automation workflow builder called Easy-Flow. 

## YOUR KNOWLEDGE ABOUT EASY-FLOW
${knowledgeContext.context}

## YOUR CAPABILITIES
Help users understand:
- How to create workflows (drag & drop steps, connect them, configure each step)
- Available step types: ${Object.values(WORKFLOW_STEPS).map(s => `${s.icon} ${s.label}`).join(', ')}
- Troubleshooting common issues
- Best practices for automation

## SUPPORT CAPABILITIES
You can also help users with support:
- If they need to contact support, provide: support@useeasyflow.com
- If they want to send an email, you can help them compose it
- For billing questions, direct them to the Settings > Billing page

If the user wants to CREATE a workflow, tell them to describe it and you'll generate it automatically.
Keep responses concise, friendly, and helpful. Use emojis occasionally.
ALWAYS base your answers on the Easy-Flow knowledge provided above when relevant.`;

    const messages = [
      { role: 'system', content: enhancedSystemPrompt },
    ];

    if (context.previousMessages) {
      messages.push(...context.previousMessages.slice(-4));
    }

    messages.push({ role: 'user', content: userMessage });

    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: 0.8,
      max_tokens: 500
    });

    return {
      success: true,
      message: completion.choices[0].message.content,
      isWorkflowRequest: false,
      knowledgeSources: knowledgeContext.sources
    };

  } catch (error) {
    logger.error('[AI Agent] Error in conversation:', error);
    return {
      success: false,
      message: "I'm having trouble connecting right now. Please try again!",
      error: error.message
    };
  }
}

/**
 * Determine if user input is a workflow request or general question
 */
function isWorkflowRequest(userMessage) {
  const workflowKeywords = [
    'create workflow', 'build workflow', 'make workflow', 'generate workflow',
    'new workflow', 'design workflow', 'setup workflow'
  ];

  const inputLower = userMessage.toLowerCase();
  return workflowKeywords.some(keyword => inputLower.includes(keyword));
}

/**
 * Main handler for AI agent interactions
 * 
 * NOW WITH FULL APP CONTROL:
 * - Uses OpenAI function calling to decide when to execute actions
 * - Can create tasks, run workflows, scrape websites, send emails, etc.
 * - All via natural language!
 * 
 * OBSERVABILITY: Full structured logging with performance & token tracking
 */
async function handleMessage(userMessage, context = {}) {
  const startTime = Date.now();
  const actionExecutor = require('./aiActionExecutor');
  
  // Create user-scoped logger for this interaction
  const msgLogger = logger
    .withUser({ id: context.userId, email: context.userEmail })
    .withOperation('ai.agent.handleMessage', {
      messageLength: userMessage?.length || 0
    });
  
  // Check if OpenAI is configured
  const openai = getOpenAI();
  if (!openai) {
    msgLogger.warn('OpenAI not configured, returning fallback response');
    return {
      type: 'conversation',
      success: true,
      message: "I'm sorry, but the AI features are currently not available. Please contact support or try again later. You can still create workflows manually using the drag-and-drop interface!",
      aiEnabled: false
    };
  }
  
  try {
    msgLogger.info('Processing AI message', {
      messagePreview: userMessage?.slice(0, 50),
      hasContext: !!context.previousMessages
    });
    
    // Get available actions as OpenAI tools
    const tools = actionExecutor.getActionsAsTools();
    
    // Also add workflow generation as a tool
    tools.push({
      type: 'function',
      function: {
        name: 'generate_workflow',
        description: 'Generate a complete workflow configuration from natural language description. Use this when user wants to create a new multi-step workflow.',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Natural language description of the workflow to create' }
          },
          required: ['description']
        }
      }
    });

    // Build system prompt with capabilities
    const systemPrompt = `You are a friendly AI assistant for Easy-Flow, an automation platform. You help everyday people automate tasks without needing technical knowledge.

WHAT YOU CAN DO:
1. Quick Actions: Scrape websites, send emails, make API calls, check account status
2. Build Workflows: Create multi-step automations
3. Manage: List tasks/workflows, check history, schedule things
4. Help: Answer questions, troubleshoot, contact support

COMMUNICATION STYLE - THIS IS CRITICAL:
- ALWAYS respond in simple, plain English that anyone can understand
- NEVER use technical jargon like: JavaScript, CSS selectors, API, DOM, rendering, parsing, JSON, HTTP, endpoints, etc.
- If something technical happens, explain it simply: "The website blocked our request" NOT "JavaScript rendering prevented extraction"
- Focus on WHAT happened and WHAT TO DO NEXT, not WHY technically
- Be warm, helpful, and encouraging - like talking to a friend
- Use everyday analogies when explaining things
- If something didn't work, suggest simple alternatives the user can try
- Keep responses SHORT and actionable

EXAMPLES OF GOOD VS BAD RESPONSES:
❌ BAD: "The page uses JavaScript rendering so dynamic content wasn't loaded. Try specifying CSS selectors."
✅ GOOD: "I checked the website but couldn't find the prices - they might be hidden. Try giving me a direct link to a specific product page!"

❌ BAD: "The API returned a 403 error due to authentication failure."
✅ GOOD: "The website blocked my access. This sometimes happens with certain sites. Want to try a different website?"

BE HELPFUL:
- If scraping a homepage doesn't find what user wants, suggest they try a more specific page URL
- Don't just say "I couldn't find it" - offer to try a different approach
- Keep responses short and actionable

RULES:
- For simple ONE-TIME actions (scrape a site now, send one email), do them directly
- For RECURRING automations ("monitor daily", "check every hour", "weekly report"), use create_automated_workflow - this will create AND schedule it automatically
- For questions about the app, respond conversationally
- Always confirm before sending emails or making changes
- Be friendly and use emojis occasionally 😊

WHEN TO USE create_automated_workflow:
- User says "daily", "weekly", "hourly", "monthly", "every", "monitor", "recurring", "automate"
- Examples: "Monitor example.com daily", "Send me weekly sales reports", "Check prices every hour"
- This creates the workflow AND schedules it in one step - no extra clicks needed!

Available automation types: ${Object.values(WORKFLOW_STEPS).map(s => `${s.icon} ${s.label}`).join(', ')}`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    if (context.previousMessages && context.previousMessages.length > 0) {
      messages.push(...context.previousMessages.slice(-6));
    }

    messages.push({ role: 'user', content: userMessage });

    // Call OpenAI with function calling
    const llmStartTime = Date.now();
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      tools,
      tool_choice: 'auto', // Let the AI decide when to use tools
      temperature: 0.7,
      max_tokens: 2000
    });
    const llmDuration = Date.now() - llmStartTime;

    // Track OpenAI API performance
    msgLogger.performance('ai.openai.completion', llmDuration, {
      category: 'ai_llm',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      tokenUsage: completion.usage
    });

    // Track token usage for cost monitoring
    if (completion.usage) {
      msgLogger.metric('ai.openai.tokens.prompt', completion.usage.prompt_tokens, 'tokens', {
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
      });
      msgLogger.metric('ai.openai.tokens.completion', completion.usage.completion_tokens, 'tokens', {
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
      });
    }

    const responseMessage = completion.choices[0].message;

    // Check if the AI wants to call a function/tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

      msgLogger.info('AI tool call requested', {
        function: functionName,
        argKeys: Object.keys(functionArgs),
        llmDuration
      });

      // Handle workflow generation specially
      if (functionName === 'generate_workflow') {
        const result = await parseNaturalLanguage(functionArgs.description, context);
        const duration = Date.now() - startTime;
        
        msgLogger.performance('ai.agent.workflow_generation', duration, {
          category: 'ai_agent',
          success: result.success,
          nodeCount: result.workflow?.nodes?.length
        });

        msgLogger.metric('ai.workflow.generated', 1, 'count', {
          success: result.success,
          nodeCount: result.workflow?.nodes?.length || 0
        });

        return {
          type: 'workflow',
          ...result
        };
      }

      // Execute the action
      const actionResult = await actionExecutor.executeAction(functionName, functionArgs, {
        userId: context.userId,
        userEmail: context.userEmail,
        timezone: context.timezone || 'UTC'
      });

      // Get a natural language response about the action result
      const followUpMessages = [
        ...messages,
        responseMessage,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(actionResult)
        }
      ];

      const followUp = await getOpenAI().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: followUpMessages,
        temperature: 0.7,
        max_tokens: 500
      });

      const duration = Date.now() - startTime;
      
      msgLogger.performance('ai.agent.action_execution', duration, {
        category: 'ai_agent',
        action: functionName,
        success: actionResult.success
      });

      msgLogger.metric('ai.action.via_chat', 1, 'count', {
        action: functionName,
        success: actionResult.success
      });

      return {
        type: 'action',
        success: actionResult.success,
        action: functionName,
        actionResult: actionResult,
        message: followUp.choices[0].message.content,
        duration
      };
    }

    // No tool call - just a conversational response
    const duration = Date.now() - startTime;
    
    msgLogger.performance('ai.agent.conversation', duration, {
      category: 'ai_agent',
      type: 'conversation'
    });

    msgLogger.metric('ai.conversation.response', 1, 'count', {
      duration
    });

    return {
      type: 'conversation',
      success: true,
      message: responseMessage.content,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    msgLogger.error('AI message handling failed', error, {
      duration,
      messageLength: userMessage?.length
    });

    msgLogger.metric('ai.agent.error', 1, 'count', {
      errorType: error.constructor.name
    });

    return {
      type: 'error',
      success: false,
      message: "Something went wrong. Please try again!",
      error: error.message
    };
  }
}

/**
 * Refine an existing workflow based on user feedback
 */
async function refineWorkflow(existingWorkflow, refinementRequest, context = {}) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { 
        role: 'assistant', 
        content: JSON.stringify({
          workflow: existingWorkflow,
          explanation: 'This is the current workflow configuration.'
        })
      },
      { 
        role: 'user', 
        content: `Please modify the workflow: ${refinementRequest}` 
      }
    ];

    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseContent = completion.choices[0].message.content;
    const parsedResponse = JSON.parse(responseContent);
    const enhancedWorkflow = enhanceWorkflow(parsedResponse.workflow);

    return {
      success: true,
      workflow: enhancedWorkflow,
      explanation: parsedResponse.explanation,
      suggestions: parsedResponse.suggestions || []
    };

  } catch (error) {
    logger.error('[AI Agent] Error refining workflow:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Learn from user feedback on AI responses
 * Feedback is stored in the rag-node-ts service for future retrieval
 */
async function learnFromFeedback(userQuery, aiResponse, wasHelpful, feedback = '') {
  try {
    // Store feedback as knowledge in RAG service
    if (wasHelpful && aiResponse) {
      await ragClient.ingestText(
        `User asked: "${userQuery}"\nHelpful response: "${aiResponse}"`,
        `easyflow:feedback:${Date.now()}`,
        { type: 'conversation_feedback', wasHelpful, feedback }
      );
    }
    logger.info('[AI Agent] Feedback recorded in rag-node-ts', { wasHelpful });
    return { success: true };
  } catch (error) {
    logger.error('[AI Agent] Error learning from feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Seed the knowledge base with app knowledge
 * Uses YOUR rag-node-ts RAG service!
 */
async function initializeKnowledge() {
  try {
    // Check if RAG service is healthy
    const health = await ragClient.healthCheck();
    
    if (!health.success) {
      logger.error('[AI Agent] rag-node-ts service not available!', {
        url: ragClient.RAG_SERVICE_URL,
        hint: 'Start your RAG service with: cd /Users/ky/rag-node-ts && npm run dev'
      });
      return { 
        success: false, 
        error: 'rag-node-ts service unavailable',
        hint: 'Start your RAG service first'
      };
    }
    
    // Seed knowledge via YOUR RAG service
    logger.info('[AI Agent] Seeding knowledge via rag-node-ts...');
    const result = await ragClient.seedEasyFlowKnowledge();
    
    logger.info('[AI Agent] Knowledge seeded to rag-node-ts', {
      successful: result.successful,
      failed: result.failed
    });
    
    return { 
      success: result.success, 
      method: 'rag-node-ts',
      successCount: result.successful,
      errorCount: result.failed,
      message: `Seeded ${result.successful} knowledge items to your RAG service`
    };
    
  } catch (error) {
    logger.error('[AI Agent] Error initializing knowledge:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add new knowledge to the AI
 * Uses YOUR rag-node-ts RAG service!
 */
async function addAppKnowledge(knowledge) {
  try {
    const result = await ragClient.ingestText(
      knowledge.content,
      `easyflow:${knowledge.category}:${knowledge.title.toLowerCase().replace(/\s+/g, '-')}`,
      { 
        category: knowledge.category,
        title: knowledge.title,
        keywords: knowledge.keywords || []
      }
    );
    
    if (result.success) {
      logger.info('[AI Agent] Knowledge added to rag-node-ts', { title: knowledge.title });
      return result;
    }
    
    return { success: false, error: 'Failed to add knowledge to RAG service' };
    
  } catch (error) {
    logger.error('[AI Agent] Error adding knowledge:', error);
    return { success: false, error: error.message };
  }
}

// Knowledge categories for organizing content in rag-node-ts
const KNOWLEDGE_CATEGORIES = {
  WORKFLOW_STEPS: 'workflow_steps',
  APP_FEATURES: 'app_features', 
  TROUBLESHOOTING: 'troubleshooting',
  BEST_PRACTICES: 'best_practices',
  FAQ: 'faq',
  USER_FEEDBACK: 'user_feedback'
};

module.exports = {
  handleMessage,
  parseNaturalLanguage,
  getSuggestions,
  refineWorkflow,
  isWorkflowRequest,
  learnFromFeedback,
  initializeKnowledge,
  addAppKnowledge,
  WORKFLOW_STEPS,
  KNOWLEDGE_CATEGORIES
};

