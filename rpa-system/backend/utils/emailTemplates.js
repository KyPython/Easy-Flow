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
                 (process.env.NODE_ENV === 'production' ? 'https://easy-flow-lac.vercel.app' : 'http://localhost:3000');
  
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
                  Our visual workflow builder makes it easy to connect multiple steps. Create workflows like: "Scrape website → Extract data → Send email → Update spreadsheet" all in one flow.
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
                    <a href="${appUrl}/app/workflows/builder" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Create Your First Workflow →</a>
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
Our visual workflow builder makes it easy to connect multiple steps. Create workflows like: "Scrape website → Extract data → Send email → Update spreadsheet" all in one flow.

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

module.exports = {
  getAutomationTipsEmail
};

