/**
 * AI Workflow Agent Component
 * 
 * A unified AI assistant for creating workflows AND handling support.
 * Users can describe what they want to automate or get help with the app.
 * Supports theme context for consistent styling across the app.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../utils/ThemeContext';
import { config } from '../../utils/config';
import styles from './AIWorkflowAgent.module.css';

const API_BASE = config.apiBaseUrl;
const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || 'support@easyflow.io';

// Example prompts to inspire users - organized by action type
const EXAMPLE_PROMPTS = [
  {
    icon: '⚡',
    title: 'Quick Action',
    prompt: 'Scrape the headlines from https://news.ycombinator.com',
    category: 'action',
    description: 'Do something right now'
  },
  {
    icon: '🔄',
    title: 'Build Workflow',
    prompt: 'Create a workflow that checks prices on amazon.com daily and emails me if they drop below $50',
    category: 'workflow',
    description: 'Automate a multi-step process'
  },
  {
    icon: '📋',
    title: 'Manage Tasks',
    prompt: 'Show me all my tasks',
    category: 'action',
    description: 'View or create tasks'
  },
  {
    icon: '❓',
    title: 'Get Help',
    prompt: 'What can I automate with Easy-Flow?',
    category: 'support',
    description: 'Ask questions about the app'
  }
];

// Support action patterns for intent detection
const SUPPORT_PATTERNS = {
  contactSupport: [
    'contact support', 'email support', 'reach support', 'talk to support',
    'need help', 'having issues', 'something broken', 'bug', 'problem',
    'not working', 'doesn\'t work', 'error', 'stuck'
  ],
  openMail: [
    'open email', 'open mail', 'compose email', 'write email', 
    'send email to', 'mailto', 'email client'
  ],
  billing: [
    'billing', 'payment', 'invoice', 'subscription', 'upgrade', 'pricing',
    'cancel', 'refund', 'charge'
  ],
  howTo: [
    'how do i', 'how to', 'how can i', 'what is', 'explain', 'help me',
    'tutorial', 'guide', 'instructions', 'learn'
  ]
};

// Detect support intent from message
function detectSupportIntent(message) {
  const lowerMsg = message.toLowerCase();
  
  for (const [intent, patterns] of Object.entries(SUPPORT_PATTERNS)) {
    if (patterns.some(p => lowerMsg.includes(p))) {
      return intent;
    }
  }
  return null;
}

// Message component for chat bubbles
const Message = ({ message, isUser, isTyping, onApplyWorkflow, onAction }) => {
  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.aiMessage}`}>
      {!isUser && (
        <div className={styles.avatar}>
          <span className={styles.avatarIcon}>🤖</span>
        </div>
      )}
      <div className={styles.messageContent}>
        {isTyping ? (
          <div className={styles.typingIndicator}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          <>
            <div className={styles.messageText}>{message.content}</div>
            
            {/* Show workflow preview if available */}
            {message.workflow && (
              <div className={styles.workflowPreview}>
                <div className={styles.workflowHeader}>
                  <span className={styles.workflowIcon}>✨</span>
                  <span className={styles.workflowTitle}>{message.workflow.name}</span>
                </div>
                <p className={styles.workflowDescription}>{message.workflow.description}</p>
                
                {/* Visual step preview */}
                <div className={styles.stepsPreview}>
                  {message.workflow.nodes?.slice(0, 5).map((node, idx) => (
                    <div key={node.id} className={styles.stepBadge}>
                      <span className={styles.stepIcon}>{getStepIcon(node.data?.stepType)}</span>
                      <span className={styles.stepLabel}>{node.data?.label}</span>
                      {idx < Math.min(message.workflow.nodes.length - 1, 4) && (
                        <span className={styles.stepArrow}>→</span>
                      )}
                    </div>
                  ))}
                  {message.workflow.nodes?.length > 5 && (
                    <span className={styles.moreSteps}>+{message.workflow.nodes.length - 5} more</span>
                  )}
                </div>

                <button 
                  className={styles.applyButton}
                  onClick={() => onApplyWorkflow(message.workflow)}
                >
                  <span>✓</span> Apply This Workflow
                </button>
              </div>
            )}

            {/* Show action buttons if available */}
            {message.actions && message.actions.length > 0 && (
              <div className={styles.actionButtons}>
                {message.actions.map((action, idx) => (
                  <button
                    key={idx}
                    className={`${styles.actionBtn} ${styles[action.variant || 'primary']}`}
                    onClick={() => onAction(action)}
                  >
                    {action.icon && <span>{action.icon}</span>}
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Show suggestions if available */}
            {message.suggestions && message.suggestions.length > 0 && (
              <div className={styles.suggestions}>
                <span className={styles.suggestionsLabel}>💡 Suggestions:</span>
                <ul>
                  {message.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className={styles.avatar}>
          <span className={styles.avatarIcon}>👤</span>
        </div>
      )}
    </div>
  );
};

// Get icon for step type
function getStepIcon(stepType) {
  const icons = {
    start: '🎬',
    web_scrape: '🌐',
    api_call: '🔗',
    data_transform: '🔄',
    condition: '❓',
    email: '📧',
    file_upload: '📁',
    delay: '⏰',
    end: '🏁'
  };
  return icons[stepType] || '📦';
}

const AIWorkflowAgent = ({ onWorkflowGenerated, isOpen, onClose }) => {
  const { theme } = useTheme() || { theme: 'light' };
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      content: `Hey! 👋 I'm your Easy-Flow AI Assistant. Here's what I can do:

**⚡ Quick Actions** — Just tell me what to do:
• "Scrape https://example.com for product prices"
• "Send an email to john@example.com saying hello"
• "Show me my tasks"

**🔄 Build Workflows** — Describe what you want to automate:
• "Create a workflow that monitors a website daily and alerts me of changes"
• "Build an automation that pulls data from an API and saves it"

**❓ Get Help** — Ask me anything:
• "How do workflows work?"
• "What can I automate?"

👇 **Try clicking one of the examples below, or just type what you need!**`,
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Check AI health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ai-agent/health`);
        const data = await response.json();
        setAiEnabled(data.aiEnabled);
      } catch (error) {
        console.error('AI health check failed:', error);
        // Fall back to local support-only mode
        setAiEnabled(false);
      }
    };
    checkHealth();
  }, []);

  // Handle action button clicks
  const handleAction = useCallback((action) => {
    switch (action.type) {
      case 'mailto':
        window.location.href = action.href;
        break;
      case 'link':
        window.open(action.href, '_blank');
        break;
      case 'sendSupport':
        // Send email to support on behalf of user
        sendSupportEmail(action.subject, action.body);
        break;
      default:
        console.log('Unknown action:', action);
    }
  }, []);

  // Send support email via backend
  const sendSupportEmail = async (subject, body) => {
    try {
      const response = await fetch(`${API_BASE}/api/ai-agent/send-support-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, body })
      });
      
      if (response.ok) {
        setMessages(prev => [...prev, {
          id: `support-sent-${Date.now()}`,
          content: "✅ Your message has been sent to our support team! We'll get back to you within 24 hours.",
          isUser: false,
          timestamp: new Date()
        }]);
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      // Fallback to mailto
      const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setMessages(prev => [...prev, {
        id: `support-fallback-${Date.now()}`,
        content: "I couldn't send the email directly. Click the button below to open your email client:",
        isUser: false,
        timestamp: new Date(),
        actions: [{
          type: 'mailto',
          href: mailtoHref,
          label: '📧 Open Email Client',
          variant: 'primary'
        }]
      }]);
    }
  };

  // Handle support-related messages locally
  const handleSupportMessage = (userMessage, intent) => {
    let response = {
      content: '',
      actions: [],
      suggestions: []
    };

    switch (intent) {
      case 'contactSupport':
        response.content = "I'd be happy to help you reach our support team! How would you like to proceed?";
        response.actions = [
          {
            type: 'mailto',
            href: `mailto:${SUPPORT_EMAIL}?subject=Support Request from Easy-Flow&body=Hi Easy-Flow Support,%0A%0AI need help with:%0A%0A`,
            label: '📧 Open Email Client',
            icon: '✉️',
            variant: 'primary'
          },
          {
            type: 'sendSupport',
            subject: 'Support Request from Easy-Flow User',
            body: `User Message: ${userMessage}\n\nTimestamp: ${new Date().toISOString()}`,
            label: '🚀 Send Directly',
            icon: '📤',
            variant: 'secondary'
          }
        ];
        break;

      case 'openMail':
        const emailMatch = userMessage.match(/(?:to|email)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const targetEmail = emailMatch ? emailMatch[1] : '';
        
        response.content = targetEmail 
          ? `Opening your email client to compose an email to ${targetEmail}...`
          : "I'll help you open your email client. Click the button below:";
        response.actions = [{
          type: 'mailto',
          href: `mailto:${targetEmail}`,
          label: `📧 Compose Email${targetEmail ? ` to ${targetEmail}` : ''}`,
          variant: 'primary'
        }];
        break;

      case 'billing':
        response.content = "For billing inquiries, our team is ready to help! Your account details and subscription information are secure.";
        response.actions = [
          {
            type: 'mailto',
            href: `mailto:${SUPPORT_EMAIL}?subject=Billing Inquiry - Easy-Flow&body=Hi,%0A%0AI have a question about my billing:%0A%0A`,
            label: '💳 Contact Billing Support',
            variant: 'primary'
          },
          {
            type: 'link',
            href: '/app/settings',
            label: '⚙️ View My Subscription',
            variant: 'secondary'
          }
        ];
        break;

      case 'howTo':
        response.content = "Great question! Here's some quick guidance:\n\n" +
          "**Creating Workflows:**\n" +
          "1. Click 'AI Assistant' and describe what you want\n" +
          "2. Or drag steps from the toolbar to the canvas\n" +
          "3. Connect steps by dragging between them\n" +
          "4. Click 'Run' to execute!\n\n" +
          "Want me to create a workflow for you? Just describe it!";
        response.suggestions = [
          'Create a simple web scraping workflow',
          'Set up email notifications',
          'Connect to an API'
        ];
        break;

      default:
        response.content = "I'm here to help! You can ask me to:\n\n" +
          "• Create automations (\"Scrape prices and email me daily\")\n" +
          "• Get help with features (\"How do I schedule a workflow?\")\n" +
          "• Contact support (\"I need help with billing\")";
    }

    return response;
  };

  // Send message to AI
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // First, check if this is a support-related query we can handle locally
    const supportIntent = detectSupportIntent(userMessage.content);
    
    if (supportIntent && !aiEnabled) {
      // Handle support queries locally when AI is not available
      const supportResponse = handleSupportMessage(userMessage.content, supportIntent);
      setMessages(prev => [...prev, {
        id: `support-${Date.now()}`,
        ...supportResponse,
        isUser: false,
        timestamp: new Date()
      }]);
      setIsLoading(false);
      return;
    }

    try {
      // Build context from previous messages
      const context = {
        previousMessages: messages.slice(-6).map(m => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.content
        }))
      };

      const response = await fetch(`${API_BASE}/api/ai-agent/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          context
        })
      });

      const data = await response.json();

      // Check if the AI detected a support intent
      if (data.supportIntent) {
        const supportResponse = handleSupportMessage(userMessage.content, data.supportIntent);
        setMessages(prev => [...prev, {
          id: `ai-support-${Date.now()}`,
          content: data.message || supportResponse.content,
          isUser: false,
          timestamp: new Date(),
          actions: supportResponse.actions,
          suggestions: data.suggestions || supportResponse.suggestions
        }]);
      } else {
        // Handle different response types from the AI agent
        let content = '';
        let workflow = null;
        let actionResult = null;

        switch (data.type) {
          case 'conversation':
            // Simple conversation response
            content = data.message || "I'm here to help! What would you like to do?";
            break;
            
          case 'workflow':
            // AI generated a workflow
            content = data.explanation || "I've created a workflow for you! Check it out below.";
            workflow = data.workflow;
            break;
            
          case 'action':
            // AI executed an action (scrape, email, etc.)
            content = data.message || `Action "${data.action}" completed.`;
            actionResult = data.actionResult;
            break;
            
          case 'error':
            content = data.message || data.error || "Something went wrong. Please try again!";
            break;
            
          default:
            // Fallback for unknown response types
            content = data.message || data.explanation || "I'm not sure how to respond to that. Can you try rephrasing?";
            workflow = data.workflow;
        }

        const aiMessage = {
          id: `ai-${Date.now()}`,
          content,
          isUser: false,
          timestamp: new Date(),
          workflow,
          actionResult,
          suggestions: data.suggestions
        };
        setMessages(prev => [...prev, aiMessage]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Try to handle as support query if API fails
      const supportIntent = detectSupportIntent(userMessage.content);
      if (supportIntent) {
        const supportResponse = handleSupportMessage(userMessage.content, supportIntent);
        setMessages(prev => [...prev, {
          id: `fallback-${Date.now()}`,
          ...supportResponse,
          isUser: false,
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          content: "I'm having trouble connecting right now. For immediate help, you can reach our support team directly:",
          isUser: false,
          timestamp: new Date(),
          actions: [{
            type: 'mailto',
            href: `mailto:${SUPPORT_EMAIL}?subject=Support Request&body=I was trying to: ${encodeURIComponent(userMessage.content)}`,
            label: '📧 Contact Support',
            variant: 'primary'
          }]
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle applying generated workflow
  const handleApplyWorkflow = useCallback((workflow) => {
    if (onWorkflowGenerated) {
      onWorkflowGenerated(workflow);
      
      // Add confirmation message
      setMessages(prev => [...prev, {
        id: `applied-${Date.now()}`,
        content: "✅ Workflow applied! You can now see it on the canvas. Feel free to customize the steps or run it directly.",
        isUser: false,
        timestamp: new Date()
      }]);
    }
  }, [onWorkflowGenerated]);

  // Handle example prompt click
  const handleExampleClick = (prompt) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${styles.agentPanel} ${theme === 'dark' ? styles.dark : styles.light}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.headerIcon}>🤖</span>
          <div>
            <h3>AI Assistant</h3>
            <span className={`${styles.status} ${aiEnabled ? styles.online : styles.offline}`}>
              {aiEnabled ? '● AI Ready' : '● Support Mode'}
            </span>
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        {messages.map((msg) => (
          <Message
            key={msg.id}
            message={msg}
            isUser={msg.isUser}
            onApplyWorkflow={handleApplyWorkflow}
            onAction={handleAction}
          />
        ))}
        
        {isLoading && (
          <Message
            message={{ content: '' }}
            isUser={false}
            isTyping={true}
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Example prompts */}
      {messages.length <= 1 && (
        <div className={styles.examplesSection}>
          <span className={styles.examplesLabel}>Quick start examples:</span>
          <div className={styles.examplesGrid}>
            {EXAMPLE_PROMPTS.map((example, idx) => (
              <button
                key={idx}
                className={styles.exampleCard}
                onClick={() => handleExampleClick(example.prompt)}
                title={example.prompt}
              >
                <span className={styles.exampleIcon}>{example.icon}</span>
                <div className={styles.exampleText}>
                  <span className={styles.exampleTitle}>{example.title}</span>
                  <span className={styles.exampleDescription}>{example.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe a workflow or ask for help..."
            className={styles.input}
            rows={1}
            disabled={isLoading}
          />
          <button
            className={styles.sendButton}
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className={styles.sendingIcon}>⏳</span>
            ) : (
              <span className={styles.sendIcon}>➤</span>
            )}
          </button>
        </div>
        <div className={styles.inputHint}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};

AIWorkflowAgent.propTypes = {
  onWorkflowGenerated: PropTypes.func,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func
};

AIWorkflowAgent.defaultProps = {
  isOpen: false,
  onClose: () => {}
};

// Floating Toggle Button Component - Export separately
export const AIAgentToggle = ({ onClick, isOpen }) => {
  const { theme } = useTheme() || { theme: 'light' };
  
  if (isOpen) return null;
  
  return (
    <button 
      className={`${styles.toggleButton} ${theme === 'dark' ? styles.dark : ''}`}
      onClick={onClick}
      aria-label="Open AI Assistant"
      title="Open AI Assistant - Create workflows with natural language"
    >
      <span>🤖</span>
    </button>
  );
};

AIAgentToggle.propTypes = {
  onClick: PropTypes.func.isRequired,
  isOpen: PropTypes.bool
};

export default AIWorkflowAgent;
