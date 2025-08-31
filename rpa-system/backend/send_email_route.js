const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');

const {
  SEND_EMAIL_WEBHOOK_SECRET,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
} = process.env;

let sendgridConfigured = false;
if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  sendgridConfigured = true;
  console.log('[send_email_route] SendGrid mailer configured.');
} else {
  console.warn(
    '⚠️ Missing SendGrid configuration (SENDGRID_API_KEY, SENDGRID_FROM_EMAIL), email sending will be disabled.'
  );
}

if (!SEND_EMAIL_WEBHOOK_SECRET) {
  console.warn('⚠️ Missing SEND_EMAIL_WEBHOOK_SECRET, the /api/send-email-now endpoint is not secure.');
}

// A simple template renderer to replace placeholders like {{name}}
function escapeRegExp(string) {
  // $& means the whole matched string
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderTemplate(templateString, data) {
  if (!data) return templateString;
  let rendered = templateString;
  for (const key in data) {
    const regex = new RegExp(`{{${escapeRegExp(key)}}}`, 'g');
    rendered = rendered.replace(regex, data[key] || '');
  }
  return rendered;
}

// Store email templates here. You can also load these from .html files.
const emailTemplates = {
  'welcome': {
    subject: 'Welcome to EasyFlow!',
    html: `
      <h1>Welcome!</h1>
      <p>We're excited to have you on board with EasyFlow.</p>
      <p>You can get started by visiting your dashboard.</p>
      <br>
      <p>Cheers,</p>
      <p>The EasyFlow Team</p>
    `,
  },
  'welcome_followup': {
    subject: 'Getting the most out of EasyFlow',
    html: `
      <h1>Quick Tip</h1>
      <p>Did you know you can connect EasyFlow to other apps?</p>
      <p>Let us know if you have any questions!</p>
    `,
  },
  'password_reset': {
    subject: 'Your Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>We received a request to reset your password. Click the link below to set a new one:</p>
      <a href="{{reset_link}}">Reset Password</a>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  },
};

// Middleware to protect this internal-only endpoint
router.use('/api/send-email-now', (req, res, next) => {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (SEND_EMAIL_WEBHOOK_SECRET && token === SEND_EMAIL_WEBHOOK_SECRET) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: invalid or missing secret' });
});

router.post('/api/send-email-now', async (req, res) => {
  if (!sendgridConfigured) {
    return res.status(503).json({ error: 'Email service (SendGrid) is not configured on the server.' });
  }

  const { to_email, template, data } = req.body || {};

  if (!to_email || !template) {
    return res.status(400).json({ error: 'Missing required fields: to_email and template' });
  }

  const emailTemplate = emailTemplates[template];
  if (!emailTemplate) {
    return res.status(400).json({ error: `Unknown email template: ${template}` });
  }

  try {
    const msg = {
      to: to_email,
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: SENDGRID_FROM_NAME,
      },
      subject: renderTemplate(emailTemplate.subject, data),
      html: renderTemplate(emailTemplate.html, data),
    };

    await sgMail.send(msg);

    res.json({ ok: true, message: 'Email sent via SendGrid.' });
  } catch (err) {
    console.error('SendGrid send error:', err.response?.body || err.message);
    res.status(502).json({ error: 'Failed to send email via SendGrid', details: err.response?.body });
  }
});

module.exports = router;
