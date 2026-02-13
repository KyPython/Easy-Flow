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

 const subject = '🚀 Your Free Automation Tips - Get Started with ModeLogic';

 const html = `
<!DOCTYPE html>
<html>
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Automation Tips from ModeLogic</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
 <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
 <tr>
 <td align="center" style="padding: 20px 0;">
 <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
 <!-- Header -->
 <tr>
 <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0;">
 <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🚀 Welcome to ModeLogic!</h1>
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
 <strong>ModeLogic</strong> - Cost-Optimized Automation for Founders
 </p>
 <p style="margin: 0 0 15px; color: #9ca3af; font-size: 12px;">
 You're receiving this because you signed up for automation tips.
 </p>
 <p style="margin: 0; color: #9ca3af; font-size: 12px;">
 <a href="${appUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #2563eb; text-decoration: none;">Unsubscribe</a> | 
 <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Visit ModeLogic</a>
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
 * Get email template by name
 * Supports: 'success', 'welcome', 'followup', 'welcome_followup', 'activation_reminder', 'success_tips', 'automation_tips', 'custom'
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
 const subject = '✅ Your ModeLogic Workflow Completed Successfully';

 const html = `
<!DOCTYPE html>
<html>
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Workflow Completed - ModeLogic</title>
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

 const text = `✅ Workflow Completed!\n\n${workflow_name ? `${workflow_name}\n\n` : ''}${message || 'Your workflow has completed successfully.'}\n\nCheck your ModeLogic dashboard for details.`;

 return { subject, html, text };
}

/**
 * Welcome email template
 */
function getWelcomeEmail(data = {}) {
 const { name } = data;
 const subject = 'Welcome to ModeLogic!';
 const html = `<p>Thanks for joining ModeLogic${name ? ', ' + name : ''}!</p>`;
 const text = `Thanks for joining ModeLogic${name ? ', ' + name : ''}!`;
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
    <p>Thanks for signing up for ModeLogic! Here are some quick tips to get started:</p>
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
  
  const subject = '✨ Success stories from ModeLogic users';
  const html = `
    <p>Hi${name ? ' ' + name : ''},</p>
    <p>Here are some ways other users are automating with ModeLogic:</p>
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
  const subject = customSubject || 'ModeLogic Notification';
  const html = customHtml || `<p>${customText || 'Hello from ModeLogic'}</p>`;
  const text = customText || 'Hello from EasyFlow';
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
  getCustomEmail
};

