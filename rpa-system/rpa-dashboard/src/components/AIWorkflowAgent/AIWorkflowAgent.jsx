/**
 * AI Workflow Agent Component
 * 
 * A unified AI assistant for creating workflows AND handling support.
 * Users can describe what they want to automate or get help with the app.
 * Supports theme context for consistent styling across the app.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../utils/ThemeContext';
import { config } from '../../utils/config';
import { api } from '../../utils/api';
import styles from './AIWorkflowAgent.module.css';

const API_BASE = config.apiBaseUrl;
const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || 'support@useeasyflow.com';

// Example prompts to inspire users - organized by action type
// Using reliable examples that actually automate (no manual work)
const EXAMPLE_PROMPTS = [
 {
 icon: '📌',
 title: 'Download Invoices',
 prompt: 'Download invoices from my vendor portal',
 category: 'task',
 description: 'One-click invoice automation'
 },
 {
 icon: '🌐',
 title: 'Scrape Website',
 prompt: 'Scrape example.com for prices and product names',
 category: 'task',
 description: 'Extract data from any website'
 },
 {
 icon: '📝',
 title: 'Submit Form',
 prompt: 'Submit a form on example.com with my contact information',
 category: 'task',
 description: 'Automate form submissions'
 },
 {
 icon: '🔄',
 title: 'Build Workflow',
 prompt: 'Create a workflow that checks prices on amazon.com daily and emails me if they drop below $50',
 category: 'workflow',
 description: 'Automate a multi-step process'
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

// Simple markdown renderer for AI messages
const renderMarkdown = (text) => {
 if (!text) return null;
 
 // Split by lines to handle lists and paragraphs
 const lines = text.split('\n');
 const elements = [];
 let inList = false;
 let listItems = [];
 let listKey = 0;
 
 lines.forEach((line, index) => {
 const trimmed = line.trim();
 
 // Handle numbered lists (1. item, 2. item, etc.)
 if (/^\d+\.\s/.test(trimmed)) {
 if (!inList) {
 inList = true;
 listItems = [];
 listKey = index;
 }
 const itemText = trimmed.replace(/^\d+\.\s/, '');
 listItems.push(renderInlineMarkdown(itemText));
 }
 // Handle bullet lists (- or * but not **bold**)
 else if (/^[-*]\s/.test(trimmed) && !trimmed.startsWith('**')) {
 if (!inList) {
 inList = true;
 listItems = [];
 listKey = index;
 }
 const itemText = trimmed.replace(/^[-*]\s/, '');
 listItems.push(renderInlineMarkdown(itemText));
 }
 // End of list (empty line or non-list content)
 else {
 if (inList && listItems.length > 0) {
 elements.push(
 <ul key={`list-${listKey}`} className={styles.markdownList}>
 {listItems.map((item, idx) => (
 <li key={idx}>{item}</li>
 ))}
 </ul>
 );
 inList = false;
 listItems = [];
 }
 
 // Regular paragraph (non-empty line)
 if (trimmed) {
 elements.push(
 <p key={`p-${index}`} className={styles.markdownParagraph}>
 {renderInlineMarkdown(trimmed)}
 </p>
 );
 }
 // Empty line - add spacing
 else if (elements.length > 0) {
 // Only add spacing if we have content before
 elements.push(<br key={`br-${index}`} />);
 }
 }
 });
 
 // Close any remaining list
 if (inList && listItems.length > 0) {
 elements.push(
 <ul key={`list-${listKey}-final`} className={styles.markdownList}>
 {listItems.map((item, idx) => (
 <li key={idx}>{item}</li>
 ))}
 </ul>
 );
 }
 
 return elements.length > 0 ? <>{elements}</> : <>{renderInlineMarkdown(text)}</>;
};

// Render inline markdown (bold, italic)
const renderInlineMarkdown = (text) => {
 if (!text) return null;
 
 const parts = [];
 let lastIndex = 0;
 let key = 0;
 
 // Match **bold** and *italic*
 const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
 let match;
 
 while ((match = regex.exec(text)) !== null) {
 // Add text before match
 if (match.index > lastIndex) {
 parts.push(<span key={key++}>{text.substring(lastIndex, match.index)}</span>);
 }
 
 // Add formatted text
 if (match[1].startsWith('**')) {
 // Bold
 parts.push(<strong key={key++}>{match[2]}</strong>);
 } else {
 // Italic
 parts.push(<em key={key++}>{match[3]}</em>);
 }
 
 lastIndex = regex.lastIndex;
 }
 
 // Add remaining text
 if (lastIndex < text.length) {
 parts.push(<span key={key++}>{text.substring(lastIndex)}</span>);
 }
 
 return parts.length > 0 ? parts : text;
};

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
            <div className={styles.messageText}>{isUser ? message.content : renderMarkdown(message.content)}</div>
            
            {/* Show workflow preview text if available (non-technical description) */}
            {message.workflowPreview && (
              <div className={styles.workflowPreviewText}>
                <strong>Here's what this workflow will do:</strong>
                <p>{message.workflowPreview}</p>
              </div>
            )}
            
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
 <span className={styles.stepArrow}>-></span>
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
 {message.actions.map((action, idx) => {
 // Special handling for bookmarklet - make it draggable
 if (action.type === 'bookmarklet') {
 return (
 <a
 key={idx}
 href={action.href}
 className={`${styles.actionBtn} ${styles[action.variant || 'primary']}`}
 draggable={true}
 onDragStart={(e) => {
 e.dataTransfer.setData('text/plain', action.href);
 e.dataTransfer.effectAllowed = 'copy';
 }}
 onClick={(e) => {
 e.preventDefault();
 onAction(action);
 }}
 title="Drag to your bookmarks bar, then click it on any website!"
 style={{ cursor: 'grab' }}
 >
 {action.icon && <span>{action.icon}</span>}
 {action.label}
 </a>
 );
 }
 // Regular buttons
 return (
 <button
 key={idx}
 className={`${styles.actionBtn} ${styles[action.variant || 'primary']}`}
 onClick={() => onAction(action)}
 >
 {action.icon && <span>{action.icon}</span>}
 {action.label}
 </button>
 );
 })}
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
 const navigate = useNavigate();
 const [messages, setMessages] = useState([]);
 const [inputValue, setInputValue] = useState('');
 const [isLoading, setIsLoading] = useState(false);
 const [aiEnabled, setAiEnabled] = useState(true);
 const [conversationLoaded, setConversationLoaded] = useState(false);
 const messagesEndRef = useRef(null);
 const inputRef = useRef(null);

 // Welcome message template
 const welcomeMessage = {
 id: 'welcome',
 content: `Hey! 👋 I'm your Easy-Flow AI Assistant.

⚡ QUICK ACTIONS -- Tell me what to do:
"Scrape example.com for prices"
"Send an email to john@example.com"
"Show me my tasks"
"Download invoices from my vendor portal" 📌

🔄 BUILD WORKFLOWS -- Describe automations:
"Monitor a website daily and alert me"
"Pull data from an API and save it"

✨ NEW FEATURES:
📌 Bookmarklet: One-click invoice downloads from vendor portals!
🤖 AI Extraction: FREE automatic data extraction from PDFs and web pages
🎯 Plain English: No more technical jargon - everything is user-friendly!

❓ GET HELP -- Ask me anything!

👇 Click an example below or just type!`,
 isUser: false,
 timestamp: new Date()
 };

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

 // Load previous conversations on mount
 useEffect(() => {
 const loadConversations = async () => {
 try {
 const response = await api.get('/api/ai-agent/conversations');
 const data = response.data;
 
 if (data.success && data.messages && data.messages.length > 0) {
 // Add welcome message + previous conversations
 setMessages([welcomeMessage, ...data.messages.map(msg => ({
 ...msg,
 timestamp: new Date(msg.timestamp)
 }))]);
 } else {
 // No previous conversations, show welcome message
 setMessages([welcomeMessage]);
 }
 setConversationLoaded(true);
 } catch (error) {
 console.error('Failed to load conversations:', error);
 // Show welcome message on error
 setMessages([welcomeMessage]);
 setConversationLoaded(true);
 }
 };
 loadConversations();
 }, []);

 // Check AI health on mount
 useEffect(() => {
 const checkHealth = async () => {
 try {
 const response = await api.get('/api/ai-agent/health');
 const data = response.data;
 setAiEnabled(data.aiEnabled);
 } catch (error) {
 console.error('AI health check failed:', error);
 setAiEnabled(false);
 }
 };
 checkHealth();
 }, []);

 // Save message to backend
 const saveMessage = useCallback(async (message) => {
 try {
 await api.post('/api/ai-agent/conversations', {
 content: message.content,
 isUser: message.isUser,
 workflow: message.workflow,
 suggestions: message.suggestions
 });
 } catch (error) {
 console.error('Failed to save message:', error);
 }
 }, []);

 // Clear conversation history
 const clearConversation = useCallback(async () => {
 try {
 await api.delete('/api/ai-agent/conversations');
 setMessages([welcomeMessage]);
 } catch (error) {
 console.error('Failed to clear conversation:', error);
 }
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
 case 'bookmarklet':
 // Show instructions for bookmarklet
 const instructions = action.instructions || 'Drag this button to your bookmarks bar, then click it while on any website!';
 alert(`📌 ${instructions}\n\nAfter adding to bookmarks:\n1. Go to your vendor portal\n2. Click the "EasyFlow Automation" bookmark\n3. EasyFlow opens with the URL pre-filled!`);
 // Also provide the bookmarklet code in a way they can copy
 const bookmarkletText = `javascript:(function(){const url=encodeURIComponent(window.location.href);const base=window.location.hostname==='localhost'?'http://localhost:3000':'https://app.useeasyflow.com';window.open(base+'/app/tasks?url='+url+'&task=invoice_download','_blank');alert('🚀 Opening EasyFlow!');})();`;
 navigator.clipboard.writeText(bookmarkletText).then(() => {
 // Show success message
 setMessages(prev => [...prev, {
 id: `bookmarklet-copied-${Date.now()}`,
 content: '✅ Bookmarklet code copied! Right-click your bookmarks bar -> "Add page" -> Paste the code as the URL -> Name it "EasyFlow Automation"',
 isUser: false,
 timestamp: new Date()
 }]);
 }).catch(() => {
 // Fallback if clipboard fails
 console.log('Bookmarklet code:', bookmarkletText);
 });
 break;
 case 'sendSupport':
 // Send email to support on behalf of user
 sendSupportEmail(action.subject, action.body);
 break;
 default:
 console.log('Unknown action:', action);
 }
 }, [setMessages]);

 // Send support email via backend
 const sendSupportEmail = async (subject, body) => {
 try {
 const response = await api.post('/api/ai-agent/send-support-email', { subject, body });
 
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
 "* Create automations (\"Scrape prices and email me daily\")\n" +
 "* Get help with features (\"How do I schedule a workflow?\")\n" +
 "* Contact support (\"I need help with billing\")";
 }

 return response;
 };

 // Send message to AI
 const sendMessage = async (messageText = null) => {
 const textToSend = messageText || inputValue.trim();
 if (!textToSend || isLoading) return;

 const userMessage = {
 id: `user-${Date.now()}`,
 content: textToSend,
 isUser: true,
 timestamp: new Date()
 };

 setMessages(prev => [...prev, userMessage]);
 saveMessage(userMessage); // Save user message
 setInputValue('');
 setIsLoading(true);

 // ✅ BOOKMARKLET DETECTION: Check if user mentions vendor portal/invoice download
 // Flexible pattern to catch typos, variations, and different phrasings
 const lowerMessage = textToSend.toLowerCase();
 
 // Check for invoice-related keywords (handles typos like "nvoices")
 const hasInvoiceKeyword = /\b(invoic|nvoic|invois|nvois)/i.test(textToSend);
 
 // Check for download/get/fetch actions
 const hasDownloadKeyword = /\b(download|get|fetch|grab|pull|retrieve)/i.test(textToSend);
 
 // Check for portal/website/site references
 const hasPortalKeyword = /\b(portal|website|site|page|platform)/i.test(textToSend);
 
 // Check for vendor/supplier references
 const hasVendorKeyword = /\b(vendor|supplier|merchant)/i.test(textToSend);
 
 // Match if: (vendor + portal) OR (invoice + download) OR (invoice + portal) OR (download + portal)
 const mentionsVendorPortal = (
 (hasVendorKeyword && hasPortalKeyword) ||
 (hasInvoiceKeyword && hasDownloadKeyword) ||
 (hasInvoiceKeyword && hasPortalKeyword) ||
 (hasDownloadKeyword && hasPortalKeyword) ||
 lowerMessage.includes('vendor portal') ||
 lowerMessage.includes('vendor website')
 ) && !lowerMessage.includes('bookmarklet') && !lowerMessage.includes('bookmark');
 
 if (mentionsVendorPortal) {
 // Provide bookmarklet solution immediately (before backend response)
 const bookmarkletCode = `javascript:(function(){const url=encodeURIComponent(window.location.href);const base=window.location.hostname==='localhost'?'http://localhost:3000':'https://app.useeasyflow.com';window.open(base+'/app/tasks?url='+url+'&task=invoice_download','_blank');alert('🚀 Opening EasyFlow with this page\\'s URL!\\n\\nJust add your login credentials and click "Run Automation".');})();`;
 
 setMessages(prev => [...prev, {
 id: `bookmarklet-help-${Date.now()}`,
 content: `Perfect! I can help you download invoices from your vendor portal. Here's the easiest way - no need to copy/paste URLs! 🎯\n\n**Quick Solution - Bookmarklet:**\n\n1. **Drag the button below to your bookmarks bar**\n2. **When you're on your vendor portal, just click the bookmark!**\n3. EasyFlow will open with the page URL already filled in - just add your login credentials and run! ✨\n\n**No more switching tabs or copying URLs!**`,
 isUser: false,
 timestamp: new Date(),
 actions: [{
 type: 'bookmarklet',
 href: bookmarkletCode,
 label: '📌 Drag to Bookmarks Bar',
 variant: 'primary',
 instructions: 'Drag this button to your bookmarks bar, then click it while on any website!'
 }],
 suggestions: [
 'Or just tell me the vendor portal URL and I can help you set it up',
 'I can also create a workflow that runs automatically'
 ]
 }]);
 setIsLoading(false); // Stop loading as we've provided a local response
 return; // ✅ FIX: Don't send to backend - we've already provided the solution
 }

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

 const response = await api.post('/api/ai-agent/message', {
 message: userMessage.content,
 context
 });

 const data = response.data;

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
        // Extract preview if available (non-technical description from pain mapping)
        if (data.preview) {
          workflow = { ...workflow, preview: data.preview };
        }
        break;
 
 case 'action':
 // AI executed an action (scrape, email, etc.)
 content = data.message || `Action "${data.action}" completed.`;
 actionResult = data.actionResult;
 
 // Handle email fallback (mailto link) if SendGrid isn't configured
 let emailActions = [];
 if (data.action === 'send_email' && actionResult?.data?.fallback?.type === 'mailto') {
 emailActions = [{
 type: 'mailto',
 href: actionResult.data.fallback.link,
 label: '📧 Open Email Client',
 variant: 'primary'
 }];
 }
 
 // If workflow was created, automatically navigate to workflows page
 if (data.action === 'create_automated_workflow' && actionResult?.success && actionResult?.data?.workflow_id) {
 // Close the AI assistant
 if (onClose) {
 onClose();
 }
 
 // Navigate to workflows page after a short delay to show the success message
 setTimeout(() => {
 navigate('/app/workflows');
 }, 1500); // 1.5 second delay to let user see the success message
 }
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
        workflowPreview: workflow?.preview || data.preview, // Extract preview separately for display
        actionResult,
        suggestions: data.suggestions,
        // Add email actions if available (for mailto fallback)
        actions: data.type === 'action' && actionResult?.data?.fallback?.type === 'mailto' ? [{
          type: 'mailto',
          href: actionResult.data.fallback.link,
          label: '📧 Open Email Client',
          variant: 'primary'
        }] : undefined
      };
 setMessages(prev => [...prev, aiMessage]);
 saveMessage(aiMessage); // Save AI response
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

 // Handle example prompt click - auto-send the message
 const handleExampleClick = async (prompt) => {
 if (isLoading) return; // Don't allow clicks while processing
 setInputValue(''); // Clear input first
 await sendMessage(prompt); // Send the example prompt directly
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
 <div className={styles.headerButtons}>
 <button 
 className={styles.clearButton} 
 onClick={clearConversation} 
 aria-label="Clear conversation"
 title="Start new conversation"
 >
 🗑️
 </button>
 <button className={styles.closeButton} onClick={onClose} aria-label="Close">
 ×
 </button>
 </div>
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
 Press Enter to send * Shift+Enter for new line
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
