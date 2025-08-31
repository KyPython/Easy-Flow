// SendGrid Email Route
const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');

const {
  SEND_EMAIL_WEBHOOK_SECRET,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

// --- Service Initialization ---
let sendgridService;
if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  sendgridService = sgMail;
  console.log('[send_email_route] SendGrid mailer configured.');
}

let nodemailerService;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  nodemailerService = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465, // true for 465, false for other ports
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  console.log('[send_email_route] Nodemailer transporter configured.');
}

if (!sendgridService && !nodemailerService) {
  console.warn('⚠️ No email service configured (SendGrid or SMTP). Email sending is disabled.');
}

if (!SEND_EMAIL_WEBHOOK_SECRET) {
  console.warn('⚠️ Missing SEND_EMAIL_WEBHOOK_SECRET, the /api/send-email-now endpoint is not secure.');
}

// --- Template Rendering ---
function renderTemplate(templateString, data) {
  if (!data) return templateString;
  let rendered = templateString;
  // Basic regex escape for keys
  const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const key in data) {
    const regex = new RegExp(`{{${escapeRegExp(key)}}}`, 'g');
    rendered = rendered.replace(regex, data[key] || '');
  }
  return rendered;
}

// --- Templates ---
// Using a single set of templates. Can be customized per service if needed.
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
};

// --- Middleware ---
const authWebhook = (req, res, next) => {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (SEND_EMAIL_WEBHOOK_SECRET && token === SEND_EMAIL_WEBHOOK_SECRET) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: invalid or missing secret' });
};

// --- Main Route ---
router.post('/send-email-now', authWebhook, async (req, res) => {
  const { to_email, template, data } = req.body || {};

  if (!to_email || !template) {
    return res.status(400).json({ error: 'Missing required fields: to_email and template' });
  }

  const emailTemplate = emailTemplates[template];
  if (!emailTemplate) {
    return res.status(400).json({ error: `Unknown email template: ${template}` });
  }

  // Prefer SendGrid if configured, otherwise fall back to Nodemailer
  if (sendgridService) {
    try {
      const msg = {
        to: to_email,
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
        subject: renderTemplate(emailTemplate.subject, data),
        html: renderTemplate(emailTemplate.html, data),
      };
      await sendgridService.send(msg);
      return res.json({ ok: true, message: 'Email sent via SendGrid.' });
    } catch (err) {
      console.error('SendGrid send error:', err.response?.body || err.message);
      return res.status(502).json({ error: 'Failed to send email via SendGrid', details: err.response?.body });
    }
  } else if (nodemailerService) {
    try {
      const mailOptions = {
        from: SMTP_FROM || SENDGRID_FROM_EMAIL, // Fallback from address
        to: to_email,
        subject: renderTemplate(emailTemplate.subject, data),
        html: renderTemplate(emailTemplate.html, data),
      };
      await nodemailerService.sendMail(mailOptions);
      return res.json({ ok: true, message: 'Email sent via Nodemailer.' });
    } catch (err) {
      console.error('Nodemailer send error:', err.message);
      return res.status(502).json({ error: 'Failed to send email via SMTP', details: err.message });
    }
  } else {
    return res.status(503).json({ error: 'Email service is not configured on the server.' });
  }
});

module.exports = router;