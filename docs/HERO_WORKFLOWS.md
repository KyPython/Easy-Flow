# EasyFlow Hero Workflows

**These 3 workflows demonstrate EasyFlow's core value: Guided automation with reusable rules for non-technical users.**

---

## Hero Workflow #1: Invoice Download Automation

### The Problem
**Business owner:** "Every month I log into 3 different vendor portals, download invoices, and email them to my accountant. Takes 2 hours and I always forget one."

### The EasyFlow Solution

**Step 1: Start from Template**
- User clicks "Invoice Download" template
- Template pre-configured with:
  - Browser automation steps
  - PDF detection logic
  - Email sending setup

**Step 2: Connect Portal (Guided)**
- EasyFlow asks: "What's the URL of your vendor portal?"
- User enters: `https://vendor-portal.example.com`
- EasyFlow asks: "Do you need to log in?"
- User: "Yes"
- EasyFlow: "Enter your username and password (saved securely)"
- User enters credentials

**Step 3: Define Rules (Reusable)**
- EasyFlow: "When should invoices be sent to your accountant?"
- User creates rule: "If invoice amount > $500, send to accounting@company.com"
- Rule saved to library (can be reused in other workflows)

**Step 4: Schedule (Plain English)**
- EasyFlow: "When should this run?"
- User: "1st of every month"
- EasyFlow: "Got it! I'll run this on the 1st of each month at 9 AM"

**Step 5: Test & Activate**
- User clicks "Test Now" button
- EasyFlow runs with test data, shows preview
- User sees: "Would download 12 invoices, 3 would be sent to accounting"
- User clicks "Activate"

**Result:**
- **Before:** 2 hours/month manually downloading invoices
- **After:** 0 hours/month (fully automated)
- **Time saved:** 24 hours/year

---

## Hero Workflow #2: Client Onboarding Flow

### The Problem
**Agency owner:** "When a new client signs up, I need to: send welcome email, add them to our CRM, create a project in our project management tool, and notify the team. Takes 15 minutes per client, and I have 20 clients/month."

### The EasyFlow Solution

**Step 1: Choose Industry Template**
- User selects: "Agency" industry
- EasyFlow shows: "Client Onboarding for Agencies" template
- Template includes:
  - Welcome email template
  - CRM integration steps
  - Project management setup
  - Team notification logic

**Step 2: Define Business Rules (Once, Reuse Everywhere)**
- EasyFlow: "How do you define a VIP client?"
- User creates rule: "VIP client = contract value > $5,000"
- Rule saved to library

- EasyFlow: "How do you route clients?"
- User creates rule: "VIP clients → Sales team, Standard clients → Support team"
- Rule saved to library

**Step 3: Connect Systems (Guided Wizard)**
- EasyFlow asks business questions (not technical):
  - "Where do new clients come from?" → User: "Stripe"
  - "Where should client info be stored?" → User: "HubSpot CRM"
  - "Where do you manage projects?" → User: "Monday.com"
  - "Who should be notified?" → User: "Sales team Slack channel"

- EasyFlow handles technical details (webhooks, API keys) behind the scenes

**Step 4: Map Data Flow (Visual)**
- EasyFlow shows: "Stripe webhook → Extract client info → Apply rules → Route to team → Create project"
- User can see exactly what happens at each step

**Step 5: Test with Fake Data**
- User clicks "Test with Sample Client"
- EasyFlow creates fake client: "John Doe, $6,000 contract"
- User sees:
  - ✅ Welcome email would be sent
  - ✅ Client would be added to HubSpot (VIP client tag)
  - ✅ Project would be created in Monday.com
  - ✅ Sales team would be notified in Slack
  - ✅ **Decision log:** "Routed to Sales team because: Contract value ($6,000) > VIP threshold ($5,000)"

**Step 6: Activate**
- User clicks "Activate"
- Workflow runs automatically for all new clients

**Result:**
- **Before:** 15 min/client × 20 clients = 5 hours/month
- **After:** 0 hours/month (fully automated)
- **Time saved:** 60 hours/year
- **Bonus:** Rules can be reused in other workflows (e.g., "VIP client" rule used in billing, support routing)

---

## Hero Workflow #3: Weekly CEO Snapshot

### The Problem
**CEO:** "Every Monday I spend 2 hours pulling data from Stripe, our website, and database to create a weekly report. I need to know: revenue, new leads, active users, and any red flags."

### The EasyFlow Solution

**Step 1: Start from Template**
- User selects: "Weekly CEO Report" template
- Template pre-configured with:
  - Data sources (Stripe, website, database)
  - Report format (email with charts)
  - Alert logic (red flags)

**Step 2: Connect Data Sources (Guided)**
- EasyFlow asks: "Where does your revenue data live?"
- User: "Stripe"
- EasyFlow: "Connect your Stripe account" (OAuth flow)

- EasyFlow: "Where do leads come from?"
- User: "Website contact forms"
- EasyFlow: "Which forms?" (shows list, user selects)

- EasyFlow: "Where are users stored?"
- User: "Our database"
- EasyFlow: "Enter connection details" (guided form)

**Step 3: Define Business Rules (Reusable)**
- EasyFlow: "What makes a lead 'high-value'?"
- User creates rule: "High-value lead = form submission with 'budget > $10,000'"
- Rule saved to library

- EasyFlow: "What's a 'churn risk'?"
- User creates rule: "Churn risk = user inactive > 30 days"
- Rule saved to library

**Step 4: Customize Report**
- EasyFlow shows report preview:
  - Revenue: $45,000 (from Stripe)
  - New leads: 12 (from website)
  - High-value leads: 3 (rule applied)
  - Active users: 1,250 (from database)
  - Churn risks: 2 (rule applied)
- User can customize: "Add chart for revenue trend"

**Step 5: Schedule (Plain English)**
- EasyFlow: "When should this report be sent?"
- User: "Every Monday at 9 AM"
- EasyFlow: "Got it! Report will be sent every Monday at 9 AM"

**Step 6: Test & Activate**
- User clicks "Test Report"
- EasyFlow generates sample report with real data structure
- User sees preview: "This is what your CEO will receive"
- User clicks "Activate"

**Result:**
- **Before:** 2 hours every Monday = 104 hours/year
- **After:** 0 hours (fully automated)
- **Time saved:** 104 hours/year
- **Bonus:** Rules can be reused (e.g., "high-value lead" rule used in sales routing)

---

## Why These Workflows Work

### 1. Templates Remove "Blank Page" Problem
- Users start from real business workflows, not abstract automation concepts
- Templates are industry-specific (freelancer, agency, home services)
- Each template includes sample data and step-by-step guide

### 2. Rules Library Prevents Logic Sprawl
- Business rules defined once ("VIP client = >$5k")
- Rules reused across multiple workflows
- Change rule once, updates everywhere

### 3. Guided Wizards Ask Business Questions
- "Where do clients come from?" not "What's your webhook URL?"
- "When should this run?" not "What's the cron expression?"
- Technical details handled behind the scenes

### 4. Safe Testing & Decision Logs
- "Test with fake data" button shows exactly what will happen
- Decision logs explain "why" something happened
- One-click rollback if something breaks

---

## Implementation Notes

### For Developers
- These workflows should be built as templates in the `workflow_templates` table
- Rules should be stored in a `business_rules` table
- Decision logs should be stored in `workflow_execution_logs` table
- Test mode should use a separate execution environment

### For Product
- These 3 workflows should be featured prominently on landing page
- Each workflow should have a "See it in action" demo video
- Template gallery should be organized by industry/use case
- Rules library should be accessible from workflow builder

