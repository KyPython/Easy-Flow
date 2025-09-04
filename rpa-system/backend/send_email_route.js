// ...existing code...
const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const { enqueueEvent } = require('./event_forwarder');
const crypto = require('crypto');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function forwardEmailWebhook(targetUrl, payload, opts = {}) {
  const id = opts.id || payload?.id || crypto.randomUUID?.() || (Date.now() + '-' + Math.random());
  enqueueEvent({
    id,
    url: targetUrl,
    method: 'post',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: payload
  });
}

router.post('/send-email-now', async (req, res) => {
  const { to_email, template, data } = req.body;
  let subject, text, html;

  if (template === 'welcome') {
    subject = 'Welcome to EasyFlow!';
    text = `Hi there!\n\nWelcome to EasyFlow. I'm excited to have you on board.\n\nIf you have any questions, just reply to this email.\n\nBest,\nKyJahn Smith`;
    html = `
      <h2>Welcome to EasyFlow!</h2>
      <p>I'm excited to have you on board.</p>
      <p>If you have any questions, just reply to this email.</p>
      <p>Best,<br/>KyJahn Smith</p>
    `;
  } else if (template === 'welcome_followup') {
    subject = 'How is EasyFlow working for you?';
    text = `Just checking in!\n\nHope you're enjoying EasyFlow so far. Let me know if you need help getting started.\n\nBest,\nKyJahn Smith`;
    html = `
      <h2>Just checking in!</h2>
      <p>Hope you're enjoying EasyFlow so far. Let me know if you need help getting started.</p>
      <p>Best,<br/>KyJahn Smith</p>
    `;
  } else if (template === 'referral_confirmation') {
    const { referredEmail } = data || {};
    subject = 'Your referral was sent!';
    text = `Thanks for referring ${referredEmail} to EasyFlow! You’ll get 1 month free when they sign up.`;
    html = `<p>Thanks for referring <b>${referredEmail}</b> to EasyFlow!<br/>You’ll get <b>1 month free</b> when they sign up.</p>`;
  } else if (template === 'referral_invite') {
    const { referrerEmail } = data || {};
    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    subject = 'You’ve been invited to EasyFlow!';
    text = `Hi! ${referrerEmail} invited you to join EasyFlow. Sign up to get started and help your friend earn 1 month free! Get started here: ${appUrl}/auth`;
    html = `
      <p>Hi! <b>${referrerEmail}</b> invited you to join EasyFlow.</p>
      <p><a href="${appUrl}/auth">Get started here!</a></p>
      <p>If you sign up, your friend gets 1 month free!</p>
    `;
  } else {
    subject = 'A message from EasyFlow';
    text = `Hello!\n\nThis is a message from EasyFlow.`;
    html = `<p>Hello!<br/>This is a message from EasyFlow.</p>`;
  }

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('[send_email_route] SendGrid API Key is not configured. Set SENDGRID_API_KEY in your environment.');
      return res.status(500).json({ error: 'Email service is not configured.' });
    }
    await sgMail.send({
      to: to_email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text,
      html,
    });

    const target = process.env.EMAIL_WEBHOOK_URL;
    if (target) {
      forwardEmailWebhook(target, { event: 'email.enqueued', data: { to_email, template, data } }, { id: crypto.randomUUID?.() || (Date.now() + '-' + Math.random()) });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[send_email_route] SendGrid error:', err?.message || err);
    res.status(500).json({ error: err?.message || err });
  }
});

module.exports = router;
// ...existing code...