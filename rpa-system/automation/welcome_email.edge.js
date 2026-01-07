const axios = require('axios');

const SEND_EMAIL_WEBHOOK = process.env.SEND_EMAIL_WEBHOOK;
const EMAIL_WORKER_ENDPOINT = process.env.EMAIL_WORKER_ENDPOINT;
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const AUTOMATION_TASKS_URL = process.env.AUTOMATION_TASKS_URL || 'https://www.tryeasyflow.com/app/automation/tasks';

// Helper to extract name from email if not provided
function getNameFromEmail(email) {
 if (!email) return 'there';
 return email.split('@')[0];
}

async function onUserSignup(user) {
 const firstName = user.firstName || getNameFromEmail(user.email);
 const lastName = user.lastName || '';

 // 1. Send Welcome Email via Worker
 await axios.post(
 EMAIL_WORKER_ENDPOINT,
 {
 subject: "Welcome to EasyFlow -- Let's Get Started!",
 to: user.email,
 message: `
 Hi ${firstName},
 <br><br>
 Welcome to EasyFlow! We're excited to have you onboard.<br>
 Get started by exploring your <a href="${AUTOMATION_TASKS_URL}">automation tasks</a>.<br><br>
 If you need help, reply to this email anytime.<br><br>
 Cheers,<br>
 The EasyFlow Team
 `
 },
 {
 headers: {
 'Authorization': `Bearer ${SEND_EMAIL_WEBHOOK}`,
 'Content-Type': 'application/json'
 }
 }
 );

 // 2. Push user data to HubSpot Contacts API
 await axios.post(
 `https://api.hubapi.com/crm/v3/objects/contacts?hapikey=${HUBSPOT_API_KEY}`,
 {
 properties: {
 email: user.email,
 firstname: firstName,
 lastname: lastName,
 signup_date: new Date().toISOString(),
 lead_source: 'EasyFlow Signup'
 }
 }
 );
}

module.exports = onUserSignup;