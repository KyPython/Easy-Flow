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
    subject = '🚀 Welcome to EasyFlow - Let\'s Automate Your Business!';
    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:3000';
    text = `Welcome to EasyFlow!

Thank you for joining EasyFlow - the intelligent automation platform that saves you time and eliminates repetitive tasks.

Your account is ready! Here's how to get started:

1. CREATE YOUR FIRST TASK
   Visit ${appUrl}/app/tasks to create your first automation
   • Web data extraction
   • Document processing
   • Report generation
   • And much more

2. EXPLORE THE DASHBOARD
   Monitor your automations at ${appUrl}/app
   • Track time saved
   • View completed tasks
   • Access real-time analytics

3. GET HELP WHEN YOU NEED IT
   • Documentation: ${appUrl}/docs (coming soon)
   • Support: Reply to this email anytime
   • Live chat: Available in your dashboard

QUICK START TIPS:
✓ Start with simple web data extraction tasks
✓ Use our templates for common business processes  
✓ Set up notifications to stay informed
✓ Schedule tasks to run automatically

We're here to help you succeed with automation. Don't hesitate to reach out with questions!

Best regards,
The EasyFlow Team

P.S. Keep an eye out for our follow-up email tomorrow with advanced tips and tricks.

---
EasyFlow - Intelligent Business Automation
${appUrl}`;

    html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to EasyFlow</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            line-height: 1.6; 
            color: #1e293b; 
            margin: 0; 
            padding: 0; 
            background-color: #f8fafc;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(37, 99, 235, 0.1);
        }
        .header { 
            background: linear-gradient(135deg, #2563eb, #0ea5e9); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .logo { 
            font-size: 28px; 
            font-weight: 700; 
            margin-bottom: 10px;
            font-family: 'Space Grotesk', sans-serif;
        }
        .subtitle { 
            font-size: 16px; 
            opacity: 0.9; 
        }
        .content { 
            padding: 40px 30px; 
        }
        .welcome-text { 
            font-size: 18px; 
            margin-bottom: 30px; 
            color: #475569;
        }
        .step-section { 
            margin-bottom: 30px; 
        }
        .step-header { 
            background-color: #eff6ff; 
            color: #1d4ed8; 
            padding: 15px 20px; 
            border-radius: 8px; 
            font-weight: 600; 
            margin-bottom: 15px;
            border-left: 4px solid #2563eb;
        }
        .step-content { 
            padding-left: 20px; 
            color: #475569;
        }
        .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #2563eb, #0ea5e9); 
            color: white; 
            text-decoration: none; 
            padding: 12px 24px; 
            border-radius: 8px; 
            font-weight: 600; 
            margin: 10px 5px;
            transition: transform 0.2s;
        }
        .cta-button:hover { 
            transform: translateY(-1px); 
        }
        .tips-box { 
            background-color: #f0fdf4; 
            border: 1px solid #22c55e; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 30px 0;
        }
        .tips-title { 
            color: #15803d; 
            font-weight: 600; 
            margin-bottom: 15px;
        }
        .tip-item { 
            margin: 8px 0; 
            color: #166534;
        }
        .footer { 
            background-color: #f8fafc; 
            padding: 30px; 
            text-align: center; 
            border-top: 1px solid #e2e8f0;
        }
        .footer-text { 
            color: #64748b; 
            font-size: 14px; 
        }
        ul { 
            padding-left: 20px; 
        }
        li { 
            margin: 8px 0; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀 EasyFlow</div>
            <div class="subtitle">Intelligent Business Automation</div>
        </div>
        
        <div class="content">
            <p class="welcome-text">
                <strong>Welcome to EasyFlow!</strong><br>
                Thank you for joining the intelligent automation platform that saves you time and eliminates repetitive tasks. Your account is ready to go!
            </p>
            
            <div class="step-section">
                <div class="step-header">1. CREATE YOUR FIRST TASK</div>
                <div class="step-content">
                    <p>Start automating today with these popular options:</p>
                    <ul>
                        <li>Web data extraction and monitoring</li>
                        <li>Document processing and analysis</li>
                        <li>Automated report generation</li>
                        <li>Integration between different services</li>
                    </ul>
                    <a href="${appUrl}/app/tasks" class="cta-button">Create First Task</a>
                </div>
            </div>
            
            <div class="step-section">
                <div class="step-header">2. EXPLORE YOUR DASHBOARD</div>
                <div class="step-content">
                    <p>Monitor and manage all your automations in one place:</p>
                    <ul>
                        <li>Track time saved and productivity gains</li>
                        <li>View completed and running tasks</li>
                        <li>Access real-time analytics and insights</li>
                    </ul>
                    <a href="${appUrl}/app" class="cta-button">Visit Dashboard</a>
                </div>
            </div>
            
            <div class="step-section">
                <div class="step-header">3. GET HELP WHEN YOU NEED IT</div>
                <div class="step-content">
                    <ul>
                        <li><strong>Documentation:</strong> Comprehensive guides (coming soon)</li>
                        <li><strong>Email Support:</strong> Reply to this email anytime</li>
                        <li><strong>Live Chat:</strong> Available in your dashboard</li>
                    </ul>
                </div>
            </div>
            
            <div class="tips-box">
                <div class="tips-title">💡 QUICK START TIPS</div>
                <div class="tip-item">✓ Start with simple web data extraction tasks</div>
                <div class="tip-item">✓ Use our templates for common business processes</div>
                <div class="tip-item">✓ Set up notifications to stay informed</div>
                <div class="tip-item">✓ Schedule tasks to run automatically</div>
            </div>
            
            <p>We're here to help you succeed with automation. Don't hesitate to reach out with questions!</p>
            
            <p><strong>Best regards,</strong><br>The EasyFlow Team</p>
            
            <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
                P.S. Keep an eye out for our follow-up email tomorrow with advanced tips and automation strategies.
            </p>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                EasyFlow - Intelligent Business Automation<br>
                <a href="${appUrl}" style="color: #2563eb;">${appUrl}</a>
            </div>
        </div>
    </div>
</body>
</html>
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