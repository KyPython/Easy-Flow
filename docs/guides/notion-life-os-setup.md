# Notion Life Operating System Setup Guide

Complete guide to setting up your unified Notion workspace for managing business, personal, creative, and learning aspects of your life.

## Quick Start

### 1. Get Your Notion API Key

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name it "Life OS" (or any name you prefer)
4. Select your workspace
5. Copy the **Internal Integration Token** (this is your `NOTION_API_KEY`)

### 2. Get Your Workspace Page ID

1. In Notion, create a new page (or use an existing one) where you want all databases created
2. Open that page
3. Click **"..."** (three dots) → **"Copy link"**
4. The URL will look like: `https://www.notion.so/YOUR-PAGE-NAME-XXXXXXXXXXXXXX`
5. The **ID is the part after the last dash** (the `XXXXXXXXXXXXXX` part)
6. This is your `NOTION_WORKSPACE_PAGE_ID`

### 3. Run the Setup Script

```bash
cd /Users/ky/Easy-Flow

# Set your credentials
export NOTION_API_KEY="your-notion-integration-token"
export NOTION_WORKSPACE_PAGE_ID="your-page-id"

# Run the setup
python3 setup-notion-life-os.py
```

The script will create:
- ✅ 13 databases (Projects, Tasks, Clients, Decisions, Goals, Health, Finance, Relationships, Ideas, Learning, Knowledge Base, Calendar, Time Tracking)
- ✅ All relations between databases
- ✅ A master dashboard page
- ✅ All necessary properties and select options

## What Gets Created

### Business Databases
- **Projects** - All business and personal projects with status, priority, budget tracking
- **Tasks** - Actionable tasks linked to projects, with energy levels and context
- **Clients** - Client relationships and contact management

### Decision-Making
- **Decisions** - Track all decisions, options, pros/cons, and outcomes
- **Goals** - Long-term and short-term goals with progress tracking

### Personal Life
- **Health** - Exercise, nutrition, sleep, mental health tracking
- **Finance** - Income, expenses, investments, financial goals
- **Relationships** - Track important relationships and contact frequency

### Creative & Learning
- **Ideas** - Capture and develop all ideas with impact/effort analysis
- **Learning** - Track learning goals and progress
- **Knowledge Base** - Store important knowledge and references

### Time Management
- **Calendar** - All scheduled events and appointments
- **Time Tracking** - Track how time is spent across activities

## Database Relations

The script automatically sets up:
- **Tasks ↔ Projects** (dual relation - tasks belong to projects, projects show their tasks)
- **Time Tracking ↔ Projects** (time logs linked to projects)

## Recommended Views to Create

After setup, create these filtered views in each database:

### Tasks Database
- **Today** - `Due Date = Today` AND `Status != Done`
- **This Week** - `Due Date <= This Week` AND `Status != Done`
- **By Priority** - Grouped by Priority, sorted by Due Date
- **By Energy** - Grouped by Energy Level (for energy-based task selection)
- **By Context** - Grouped by Context (Work, Personal, Health, etc.)

### Projects Database
- **Active** - `Status = Active`
- **By Priority** - Grouped by Priority
- **Overdue** - `Due Date < Today` AND `Status != Completed`

### Decisions Database
- **Pending** - `Status = Pending`, sorted by Urgency
- **This Week** - `Decision Date <= This Week` AND `Status = Pending`
- **By Impact** - Grouped by Impact level

### Goals Database
- **In Progress** - `Status = In Progress`
- **By Category** - Grouped by Category (Business, Health, Financial, etc.)
- **This Quarter** - `Target Date <= End of Quarter`

### Health Database
- **This Week** - `Date >= Start of Week`
- **By Type** - Grouped by Type (Exercise, Nutrition, Sleep, etc.)

### Finance Database
- **This Month** - `Date >= Start of Month`
- **By Category** - Grouped by Category
- **Income vs Expenses** - Filtered by Type

## Automation Ideas

Once set up, you can automate:

1. **Daily Task Review** - Create a view that shows today's tasks every morning
2. **Weekly Planning** - Auto-create weekly review pages
3. **Decision Reminders** - Notify about pending decisions
4. **Goal Progress** - Weekly goal progress updates
5. **Health Streaks** - Track consecutive days of exercise/nutrition
6. **Time Analysis** - Weekly time allocation reports

## Integration with Easy-Flow

The database IDs output by the script can be used in:
- `easyflow-metrics` scripts (for business metrics)
- Backend Notion integration (for workflow automation)
- Custom automation scripts

Save the database IDs in your `.env` file or GitHub Secrets for automation.

## Customization

You can modify `setup-notion-life-os.py` to:
- Add more databases
- Change property types
- Add custom select options
- Create additional relations
- Add formulas for calculated fields

## Troubleshooting

### "NOTION_API_KEY not set"
- Make sure you exported the environment variable before running
- Or add it to your `.env` file and source it

### "NOTION_WORKSPACE_PAGE_ID not set"
- You need to provide a page ID where databases will be created
- Get it from the page URL in Notion

### "403 Forbidden" or "401 Unauthorized"
- Make sure your integration token is valid
- Ensure the integration has access to the workspace
- Check that the page ID is correct and the integration has access to it

### Databases created but relations don't work
- Relations need both databases to exist first
- If you run the script multiple times, you may need to manually link relations
- Or modify the script to handle existing databases

## Next Steps

1. ✅ Run the setup script
2. ✅ Create recommended views in each database
3. ✅ Set up daily/weekly review templates
4. ✅ Configure automations (Notion's built-in or via API)
5. ✅ Integrate with Easy-Flow backend for business metrics
6. ✅ Set up calendar sync (if using Google Calendar integration)

## Support

For issues or questions:
- Check Notion API docs: https://developers.notion.com/
- Review the script output for specific error messages
- Check that all environment variables are set correctly
