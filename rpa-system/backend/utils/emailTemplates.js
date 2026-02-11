/**
 * Email Templates for EasyFlow
 * Professional, responsive email templates for user communications
 */

/**
 * Automation Tips Email Template
 * Sent to users who sign up for automation tips via the email capture modal
 */
function getAutomationTipsEmail(data = {}) {
 const { email, source = 'session_modal', userPlan = 'hobbyist' } = data;
 const firstName = email?.split('@')[0] || 'there';
 // Get app URL from environment, with fallback to production URL
 const appUrl = process.env.REACT_APP_PUBLIC_URL ||
 process.env.PUBLIC_URL ||
 process.env.VITE_PUBLIC_URL ||
 (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');

 const subject = '🚀 Your Free Automation Tips - Get Started with EasyFlow';

 const html = `
<!DOCTYPE html>
<html>
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Automation Tips from EasyFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
 <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
 <tr>
 <td align="center" style="padding: 20px 0;">
 <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 <!-- Header -->
 <tr>
 <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
 <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🚀 Welcome to EasyFlow!</h1>
 <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">Your automation journey starts here</p>
 </td>
 </tr>
 
 <!-- Main Content -->
 <tr>
 <td style="padding: 40px;">
 <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
 Hi ${firstName},
 </p>
 
 <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
 Thanks for joining EasyFlow! We're excited to help you automate your workflows and save time. Here are some quick tips to get you started:
 </p>
 
 <!-- Tip 1 -->
 <div style="margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #2563eb; border-radius: 4px;">
 <h3 style="margin: 0 0 10px; color: #1f2937; font-size: 18px; font-weight: 600;">💡 Tip #1: Start with Simple Automations</h3>
 <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
 Begin with one repetitive task you do daily. For example, extracting data from a website or sending a weekly report. Once you see the time savings, you'll want to automate more!
 </p>
 </div>
 
 <!-- Tip 2 -->
 <div style="margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #10b981; border-radius: 4px;">
 <h3 style="margin: 0 0 10px; color: #1f2937; font-size: 18px; font-weight: 600;">⚡ Tip #2: Use Workflow Builder</h3>
 <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
 Our visual workflow builder makes it easy to connect multiple steps. Create workflows like: "Scrape website -> Extract data -> Send email -> Update spreadsheet" all in one flow.
 </p>
 </div>
 
 <!-- Tip 3 -->
 <div style="margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-left: 4px solid #f59e0b; border-radius: 4px;">
 <h3 style="margin: 0 0 10px; color: #1f2937; font-size: 18px; font-weight: 600;">📅 Tip #3: Schedule Your Automations</h3>
 <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
 Set your workflows to run automatically on a schedule. Daily reports, weekly data syncs, or monthly summaries - set it once and forget it!
 </p>
 </div>
 
 <!-- CTA Button -->
 <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
 <tr>
 <td align="center" style="padding: 20px 0;">
 <a href="${appUrl}/app/workflows/builder" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Create Your First Workflow -></a>
 </td>
 </tr>
 </table>
 
 <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
 Need help? Reply to this email anytime - we're here to help you succeed!
 </p>
 </td>
 </tr>
 
 <!-- Footer -->
 <tr>
 <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
 <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
 <strong>EasyFlow</strong> - Automate Your Workflows, Save Your Time
 </p>
 <p style="margin: 0 0 15px; color: #9ca3af; font-size: 12px;">
 You're receiving this because you signed up for automation tips.
 </p>
 <p style="margin: 0; color: #9ca3af; font-size: 12px;">
 <a href="${appUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #2563eb; text-decoration: none;">Unsubscribe</a> | 
 <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Visit EasyFlow</a>
 </p>
 </td>
 </tr>
 </table>
 </td>
 </tr>
 </table>
</body>
</html>
 `.trim();

 const text = `
Hi ${firstName},

Thanks for joining EasyFlow! We're excited to help you automate your workflows and save time. Here are some quick tips to get you started:

💡 Tip #1: Start with Simple Automations
Begin with one repetitive task you do daily. For example, extracting data from a website or sending a weekly report. Once you see the time savings, you'll want to automate more!

⚡ Tip #2: Use Workflow Builder
Our visual workflow builder makes it easy to connect multiple steps. Create workflows like: "Scrape website -> Extract data -> Send email -> Update spreadsheet" all in one flow.

📅 Tip #3: Schedule Your Automations
Set your workflows to run automatically on a schedule. Daily reports, weekly data syncs, or monthly summaries - set it once and forget it!

Create Your First Workflow: ${appUrl}/app/workflows/builder

Need help? Reply to this email anytime - we're here to help you succeed!

---
EasyFlow - Automate Your Workflows, Save Your Time
You're receiving this because you signed up for automation tips.
Unsubscribe: ${appUrl}/unsubscribe?email=${encodeURIComponent(email)}
 `.trim();

 return { subject, html, text };
}

/**
 * Referral Invite Email Template
 * Sent to referred users when someone invites them to join EasyFlow
 */
function getReferralInviteEmail(data = {}) {
  const { referralCode, referrerName, referrerEmail } = data;
  const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || process.env.VITE_PUBLIC_URL || (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');
  const signupUrl = `${appUrl}/signup?ref=${referralCode}`;
  
  const subject = `${referrerName || 'A friend'} invited you to join EasyFlow - Get 1 month free!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to EasyFlow!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🎁 You're Invited!</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">Join EasyFlow and automate your workflows</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>${referrerName || 'Someone'}</strong> ${referrerEmail ? `(${referrerEmail})` : ''} has invited you to join EasyFlow! They've given you a special referral code for a free month of our Pro plan.
              </p>
              
              <!-- Reward Box -->
              <div style="margin: 0 0 30px; padding: 24px; background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 10px;">🎉</div>
                <h3 style="margin: 0 0 10px; color: #166534; font-size: 20px; font-weight: 600;">Your Exclusive Offer</h3>
                <p style="margin: 0; color: #15803d; font-size: 18px;">
                  <strong>1 Month Free</strong> of EasyFlow Pro when you sign up!
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${signupUrl}" style="display: inline-block; padding: 16px 40px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px;">
                      🚀 Sign Up Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px;">
                <strong>Your referral code:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 16px; letter-spacing: 1px;">${referralCode}</code>
              </p>
              
              <p style="margin: 0 0 30px; color: #6b7280; font-size: 14px;">
                Or copy and paste this link into your browser:
                <br>
                <a href="${signupUrl}" style="color: #2563eb; text-decoration: none; word-break: break-all;">${signupUrl}</a>
              </p>
              
              <!-- Features -->
              <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 15px; color: #1f2937; font-size: 16px; font-weight: 600;">With EasyFlow Pro, you can:</p>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                  <li>🤖 Automate repetitive tasks with AI-powered workflows</li>
                  <li>📊 Extract data from any website automatically</li>
                  <li>📧 Send personalized emails at scale</li>
                  <li>🔄 Connect your favorite tools and apps</li>
                  <li>⏰ Schedule workflows to run automatically</li>
                </ul>
              </div>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Need help? Just reply to this email - we're here to help you succeed!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">
                <strong>EasyFlow</strong> - Automate Your Workflows, Save Your Time
              </p>
              <p style="margin: 0 0 15px; color: #9ca3af; font-size: 12px;">
                You're receiving this because ${referrerName || 'someone'} invited you to join EasyFlow.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Visit EasyFlow</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
🎉 You're Invited to Join EasyFlow!

Hi there,

${referrerName || 'Someone'} has invited you to join EasyFlow! They've given you a special referral code for a free month of our Pro plan.

🎁 YOUR EXCLUSIVE OFFER:
1 Month Free of EasyFlow Pro when you sign up!

📍 GET STARTED:
Sign up here: ${signupUrl}

Your referral code: ${referralCode}

WHAT YOU CAN DO WITH EASYFLOW PRO:
- Automate repetitive tasks with AI-powered workflows
- Extract data from any website automatically
- Send personalized emails at scale
- Connect your favorite tools and apps
- Schedule workflows to run automatically

Need help? Just reply to this email - we're here to help you succeed!

---
EasyFlow - Automate Your Workflows, Save Your Time
  `.trim();

  return { subject, html, text };
}

/**
 * Get email template by name
 * Supports: 'success', 'welcome', 'followup', 'welcome_followup', 'activation_reminder', 'success_tips', 'automation_tips', 'referral', 'custom'
 */
function getEmailTemplate(templateName, data = {}) {
  switch (templateName) {
    case 'success':
      return getSuccessEmail(data);
    case 'welcome':
      return getWelcomeEmail(data);
    case 'followup':
    case 'welcome_followup':
      return getFollowupEmail(data);
    case 'activation_reminder':
      return getActivationReminderEmail(data);
    case 'success_tips':
      return getSuccessTipsEmail(data);
    case 'automation_tips':
      return getAutomationTipsEmail(data);
    case 'referral':
      return getReferralInviteEmail(data);
    case 'custom':
    default:
      return getCustomEmail(data);
  }
}

/**
 * Success notification email template
 * Used for workflow completion notifications
 */
function getSuccessEmail(data = {}) {
 const { message, workflow_name, execution_id } = data;
 const subject = '✅ Your EasyFlow Workflow Completed Successfully';

 const html = `
<!DOCTYPE html>
<html>
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Workflow Completed - EasyFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
 <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
 <tr>
 <td align="center" style="padding: 20px 0;">
 <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 <tr>
 <td style="padding: 40px; text-align: center;">
 <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
 <h1 style="margin: 0 0 10px; color: #1f2937; font-size: 24px; font-weight: 600;">Workflow Completed!</h1>
 ${workflow_name ? `<p style="margin: 0 0 20px; color: #6b7280; font-size: 16px;">${workflow_name}</p>` : ''}
 ${message ? `<p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">${message}</p>` : ''}
 <p style="margin: 0; color: #6b7280; font-size: 14px;">Your workflow has completed successfully. Check your EasyFlow dashboard for details.</p>
 </td>
 </tr>
 </table>
 </td>
 </tr>
 </table>
</body>
</html>
 `.trim();

 const text = `✅ Workflow Completed!\n\n${workflow_name ? `${workflow_name}\n\n` : ''}${message || 'Your workflow has completed successfully.'}\n\nCheck your EasyFlow dashboard for details.`;

 return { subject, html, text };
}

/**
 * Welcome email template
 */
function getWelcomeEmail(data = {}) {
 const { name } = data;
 const subject = 'Welcome to EasyFlow!';
 const html = `<p>Thanks for joining EasyFlow${name ? ', ' + name : ''}!</p>`;
 const text = `Thanks for joining EasyFlow${name ? ', ' + name : ''}!`;
 return { subject, html, text };
}

/**
 * Followup email template (Day 1)
 */
function getFollowupEmail(data = {}) {
  const { name } = data;
  const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');

  const subject = '🚀 Ready to automate your first task?';
  const html = `
    <p>Hi${name ? ' ' + name : ''},</p>
    <p>Thanks for signing up for EasyFlow! Here are some quick tips to get started:</p>
    <ul>
      <li>📊 <strong>Portal CSV Export</strong> - Automate login and data extraction from any website</li>
      <li>📧 <strong>Email Automation</strong> - Send automated emails based on triggers</li>
      <li>🌐 <strong>Web Scraping</strong> - Extract data from any website automatically</li>
    </ul>
    <p><a href="${appUrl}/app/workflows?view=templates" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Browse Templates</a></p>
    <p>Need help? Just reply to this email!</p>
  `;
  const text = `Hi${name ? ' ' + name : ''}, Thanks for signing up! Browse templates at ${appUrl}/app/workflows?view=templates`;
  return { subject, html, text };
}

/**
 * Activation reminder email template (Day 3)
 */
function getActivationReminderEmail(data = {}) {
  const { name } = data;
  const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');

  const subject = '💡 Create your first workflow in 5 minutes';
  const html = `
    <p>Hi${name ? ' ' + name : ''},</p>
    <p>We noticed you haven't created your first workflow yet. Let's change that!</p>
    <p>Creating your first automation is easier than you think:</p>
    <ol>
      <li>Choose a template (Portal CSV Export is popular!)</li>
      <li>Customize it for your needs</li>
      <li>Run it and watch the magic happen</li>
    </ol>
    <p><a href="${appUrl}/app/workflows?view=templates" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Create Your First Workflow</a></p>
    <p>Questions? Reply to this email - I'm here to help!</p>
  `;
  const text = `Hi${name ? ' ' + name : ''}, Create your first workflow at ${appUrl}/app/workflows?view=templates`;
  return { subject, html, text };
}

/**
 * Success tips email template (Day 7)
 */
function getSuccessTipsEmail(data = {}) {
  const { name } = data;
  const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');

  const subject = '✨ Success stories from EasyFlow users';
  const html = `
    <p>Hi${name ? ' ' + name : ''},</p>
    <p>Here are some ways other users are automating with EasyFlow:</p>
    <ul>
      <li>📊 <strong>Monthly reports</strong> - Automatically export data and email to stakeholders</li>
      <li>📧 <strong>Lead capture</strong> - Extract contact info from websites and add to CRM</li>
      <li>🔄 <strong>Data sync</strong> - Keep spreadsheets updated from multiple sources</li>
    </ul>
    <p><a href="${appUrl}/app" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
    <p>Want to automate something specific? Reply and let me know!</p>
  `;
  const text = `Hi${name ? ' ' + name : ''}, Check out success stories and templates at ${appUrl}/app`;
  return { subject, html, text };
}

/**
 * Custom email template
 */
function getCustomEmail(data = {}) {
  const { subject: customSubject, text: customText, html: customHtml } = data;
  const subject = customSubject || 'EasyFlow Notification';
  const html = customHtml || `<p>${customText || 'Hello from EasyFlow'}</p>`;
  const text = customText || 'Hello from EasyFlow';
  return { subject, html, text };
}

/**
 * Outage Notification Email Template
 * Sent to affected users during service interruptions
 */
function getOutageNotificationEmail(data = {}) {
  const { estimatedDuration = 'within 1 hour', affectedSystems = ['All services'], startTime = new Date().toISOString() } = data;
  const subject = '⚠️ EasyFlow Service Outage Notification';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px 8px 0 0;">
              <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Service Outage Update</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We experienced a service interruption starting at <strong>${startTime}</strong>.
              </p>
              <div style="margin: 20px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
                <p style="margin: 0 0 10px; color: #92400e; font-size: 14px; font-weight: 600;">AFFECTED SYSTEMS:</p>
                <ul style="margin: 0; padding-left: 20px; color: #78350f;">
                  ${affectedSystems.map(s => `<li>${s}</li>`).join('')}
                </ul>
              </div>
              <p style="margin: 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong>Estimated Resolution:</strong> ${estimatedDuration}
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Our team is working to restore full service as quickly as possible. We apologize for any inconvenience.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Service Outage Notification\n\nWe experienced a service interruption starting at ${startTime}.\n\nAffected Systems: ${affectedSystems.join(', ')}\nEstimated Resolution: ${estimatedDuration}\n\nOur team is working to restore full service. We apologize for any inconvenience.`;

  return { subject, html, text };
}

/**
 * Support Response Email Template
 * Auto-response for support tickets
 */
function getSupportResponseEmail(data = {}) {
  const { ticketNumber = 'N/A', category = 'technical', name = 'there' } = data;
  const appUrl = process.env.REACT_APP_PUBLIC_URL || process.env.PUBLIC_URL || (process.env.NODE_ENV === 'production' ? 'https://www.tryeasyflow.com' : 'http://localhost:3000');

  const templates = {
    'technical': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Technical Issue`,
      response: `Hi ${name},\n\nThank you for reaching out about this technical issue. I'm investigating this now and will provide an update within 4 hours during business hours.\n\nIn the meantime, you may want to:\n1. Check our status page at ${appUrl}/status\n2. Review our documentation at ${appUrl}/docs\n\nBest regards,\nEasyFlow Support Team`,
      priority: 'high'
    },
    'billing': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Billing Question`,
      response: `Hi ${name},\n\nThanks for your billing question. I'll look into this and respond within 8 business hours.\n\nFor urgent billing matters, please reply with your phone number and I can call you.\n\nBest regards,\nEasyFlow Support Team`,
      priority: 'normal'
    },
    'feature': {
      subject: `EasyFlow Support: Ticket #${ticketNumber} - Feature Request`,
      response: `Hi ${name},\n\nThanks for the feature suggestion! I've added it to our product roadmap for consideration.\n\nWe prioritize features based on customer demand, so your input is valuable.\n\nBest regards,\nEasyFlow Support Team`,
      priority: 'low'
    }
  };

  const template = templates[category] || templates['technical'];

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1f2937;">Support Ticket #${ticketNumber}</h2>
    <p style="color: #4b5563; white-space: pre-line;">${template.response}</p>
  </div>
</body>
</html>
  `.trim();

  return { subject: template.subject, html, text: template.response };
}

/**
 * Maintenance Window Notification Email Template
 * Sent before scheduled maintenance
 */
function getMaintenanceNotificationEmail(data = {}) {
  const { startTime = 'Saturday 6:00 AM UTC', duration = '4 hours', affectedFeatures = ['Workflow execution may be delayed', 'Dashboard may be temporarily unavailable'] } = data;
  const subject = '🔧 Scheduled Maintenance Notice - EasyFlow';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔧</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Scheduled Maintenance</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We'll be performing scheduled maintenance on EasyFlow to improve performance and reliability.
              </p>
              <div style="margin: 20px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                <p style="margin: 0 0 10px;"><strong>📅 Date/Time:</strong> ${startTime}</p>
                <p style="margin: 0;"><strong>⏱️ Duration:</strong> Approximately ${duration}</p>
              </div>
              <p style="margin: 20px 0 10px; color: #1f2937; font-size: 16px; font-weight: 600;">What this means for you:</p>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                ${affectedFeatures.map(f => `<li>${f}</li>`).join('')}
              </ul>
              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                All services will be fully operational after maintenance completes. Thank you for your patience!
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Scheduled Maintenance Notice\n\nWe'll be performing scheduled maintenance on EasyFlow.\n\nDate/Time: ${startTime}\nDuration: Approximately ${duration}\n\nWhat this means for you:\n${affectedFeatures.map(f => `- ${f}`).join('\n')}\n\nAll services will be fully operational after maintenance completes.`;

  return { subject, html, text };
}

module.exports = {
  getAutomationTipsEmail,
  getEmailTemplate,
  getSuccessEmail,
  getWelcomeEmail,
  getFollowupEmail,
  getActivationReminderEmail,
  getSuccessTipsEmail,
  getCustomEmail,
  getReferralInviteEmail,
  // Support & Operations templates
  getOutageNotificationEmail,
  getSupportResponseEmail,
  getMaintenanceNotificationEmail
};

