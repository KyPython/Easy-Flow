
const { logger, getLogger } = require('./utils/logger');
const express = require('express');
const router = express.Router();
let sgMail;
try {
	sgMail = require('@sendgrid/mail');
} catch (e) {
	// In lightweight local/dev setups the sendgrid package may not be installed.
	// Provide a minimal stub so the module can be required without crashing.
	sgMail = {
		setApiKey: () => {},
		send: async () => { throw new Error('SendGrid client not installed'); }
	};
}

// Configure SendGrid if available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || '';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'EasyFlow'; // Optional: Display name for sender

// Build FROM address with optional name: "Name <email@domain.com>" or just "email@domain.com"
const getFromAddress = () => {
  if (!SENDGRID_FROM_EMAIL) return '';
  if (SENDGRID_FROM_NAME && SENDGRID_FROM_NAME !== 'EasyFlow') {
    return `${SENDGRID_FROM_NAME} <${SENDGRID_FROM_EMAIL}>`;
  }
  return SENDGRID_FROM_EMAIL;
};

if (SENDGRID_API_KEY) {
	try { sgMail.setApiKey(SENDGRID_API_KEY); } catch (_e) { /* ignore */ }
}

// Health check
router.get('/email/health', (_req, res) => {
	res.json({ ok: true, sendgrid: Boolean(SENDGRID_API_KEY), from: Boolean(SENDGRID_FROM_EMAIL) });
});

// POST /api/send
// Body: { to_email: string, subject?: string, template?: 'welcome'|'followup'|'custom', data?: object, text?: string, html?: string }
router.post('/send', async (req, res) => {
	try {
		if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
			return res.status(503).json({ error: 'Email not configured (missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL)' });
		}
		const { to_email, subject, template = 'custom', data = {}, text, html } = req.body || {};
		if (!to_email) return res.status(400).json({ error: 'to_email is required' });

		// Simple templates
		let resolvedSubject = subject || 'EasyFlow Notification';
		let resolvedText = text || '';
		let resolvedHtml = html || '';
		if (template === 'welcome') {
			resolvedSubject = subject || 'Welcome to EasyFlow!';
			resolvedText = text || `Thanks for joining EasyFlow${data.name ? ', ' + data.name : ''}!`;
			resolvedHtml = html || `<p>Thanks for joining EasyFlow${data.name ? ', <strong>' + data.name + '</strong>' : ''}!</p>`;
		} else if (template === 'followup') {
			resolvedSubject = subject || 'How is EasyFlow working for you?';
			resolvedText = text || 'Just checking in to see how your automations are going.';
			resolvedHtml = html || '<p>Just checking in to see how your automations are going.</p>';
		} else if (template === 'automation_tips') {
			// Use the email template from utils if available
			try {
				const { getAutomationTipsEmail } = require('./utils/emailTemplates');
				const emailTemplate = getAutomationTipsEmail({
					email: to_email,
					source: data?.source || 'unknown',
					userPlan: data?.userPlan || 'hobbyist'
				});
				resolvedSubject = subject || emailTemplate.subject;
				resolvedText = text || emailTemplate.text;
				resolvedHtml = html || emailTemplate.html;
			} catch (templateError) {
				logger.warn('[send_email_route] Could not load automation_tips template, using fallback');
				resolvedSubject = subject || '🚀 Your Free Automation Tips - Get Started with EasyFlow';
				resolvedText = text || 'Thanks for signing up! Check out our automation tips to get started.';
				resolvedHtml = html || '<p>Thanks for signing up! Check out our automation tips to get started.</p>';
			}
		} else if (template === 'custom') {
			if (!text && !html) {
				resolvedText = 'Hello from EasyFlow';
				resolvedHtml = '<p>Hello from EasyFlow</p>';
			}
		}

		const msg = {
			to: to_email,
			from: getFromAddress(), // Supports "Name <email@domain.com>" format
			subject: resolvedSubject,
			text: resolvedText,
			html: resolvedHtml
		};

		const resp = await sgMail.send(msg);
		const [result] = Array.isArray(resp) ? resp : [resp];
		return res.json({ ok: true, id: result?.headers?.['x-message-id'] || null });
	} catch (e) {
		const message = e?.response?.body?.errors?.map(err => err.message).join('; ') || e?.message || 'Failed to send email';
		logger.warn('[send_email_route] send error', message);
		return res.status(500).json({ error: message });
	}
});

module.exports = router;
