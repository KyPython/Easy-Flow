# 🎯 Lead Magnet Automation System

## Overview

The Lead Magnet Automation system is a production-grade GitHub Actions workflow that automatically:

- 🔍 **Extracts pain points** from Reddit discussions every Monday at 6 AM UTC
- 📋 **Generates targeted PDF checklists** addressing user frustrations  
- 📊 **Analyzes feedback data** to provide actionable product insights
- 📝 **Updates marketing messaging** based on latest user sentiment
- 🔔 **Sends notifications** to Slack and Discord with comprehensive reports

## 🚀 Quick Setup

### 1. Enable the Workflow

The automation is defined in `.github/workflows/lead_magnet_automation.yml` and will run automatically once configured.

### 2. Configure Secrets

In your GitHub repository, go to **Settings > Secrets and Variables > Actions** and add these secrets:

```bash
# Required for Reddit API access
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Optional for notifications  
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK

# Optional for admin access
ADMIN_API_KEY=your_secure_admin_key
```

### 3. Reddit API Setup

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click **"Create App"** or **"Create Another App"**
3. Choose **"script"** as the application type
4. Fill in:
   - **Name**: `EasyFlow Lead Magnet Bot`
   - **Description**: `Automated pain point extraction for lead magnets`
   - **Redirect URI**: `http://localhost:8080` (required but not used)
5. Copy the **Client ID** (under the app name) and **Client Secret**
6. Add these to your GitHub repository secrets

### 4. Notification Setup

#### Slack Webhook:
1. Go to [Slack API Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Create a new webhook for your workspace
3. Choose the channel (e.g., `#automation`)
4. Copy the webhook URL

#### Discord Webhook:
1. Go to your Discord server settings
2. Navigate to **Integrations > Webhooks**
3. Click **Create Webhook**
4. Choose the channel and copy the webhook URL

## ⚙️ Workflow Configuration

### Schedule

By default, the workflow runs **every Monday at 6:00 AM UTC**. To change this:

```yaml
on:
  schedule:
    # Custom schedule (example: daily at 9 AM UTC)
    - cron: '0 9 * * *'
```

### Manual Triggers

You can manually trigger the workflow with custom parameters:

1. Go to **Actions** tab in your repository
2. Select **"Lead Magnet Automation Pipeline"**
3. Click **"Run workflow"**
4. Customize parameters:
   - **Reddit Keywords**: `automation,devops,self-hosting`
   - **Target Subreddits**: `selfhosted,sysadmin,docker`
   - **Force Regenerate**: `true` (ignores cache)
   - **Skip Notifications**: `false`

### Customization Options

#### Keywords and Subreddits

Edit the workflow file to change default extraction targets:

```yaml
env:
  REDDIT_KEYWORDS: 'your,custom,keywords'
  TARGET_SUBREDDITS: 'your,target,subreddits'
```

#### Notification Channels

Update the Slack notification step:

```yaml
- name: 📢 Send Slack Notification
  with:
    channel: '#your-channel'  # Change channel
    username: 'Your Bot Name'  # Customize bot name
```

## 📊 Output Files

The automation generates several key files:

### Generated Data
- **`/data/reddit_pain_points.json`** - Extracted Reddit discussions and pain points
- **`/data/feedback_analysis.json`** - Comprehensive analysis with insights
- **`/data/exports/*.csv`** - Marketing team reports (pain points, features, messaging)

### Lead Magnets  
- **`/public/downloads/checklists/*.pdf`** - Generated PDF checklists
- **`/public/downloads/checklists/checklists_summary.json`** - Checklist metadata

### Updated Content
- **`/messaging.md`** - Marketing messaging updated with latest insights

## 🔧 Troubleshooting

### Common Issues

#### 1. Reddit API Rate Limiting
**Error**: `429 Too Many Requests`
**Solution**: The workflow includes automatic retry logic, but you can:
- Reduce `MAX_REDDIT_POSTS` in environment variables
- Add delays between API calls in `fetch_reddit_feedback.py`

#### 2. PDF Generation Fails
**Error**: `reportlab import failed`
**Solution**: The workflow will automatically fall back to text format
- Check system dependencies installation step
- Verify font installation in the workflow

#### 3. No Reddit Credentials
**Error**: `Authentication failed`
**Solution**: 
- Verify `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are set correctly
- Ensure Reddit app is configured as "script" type
- Check that credentials have sufficient permissions

#### 4. Notifications Not Sending
**Error**: `Webhook failed`
**Solution**:
- Verify webhook URLs are correct and active
- Check that webhook has permissions to post to target channel
- Test webhook URLs manually with curl

### Debug Mode

To enable detailed logging, add this to your workflow environment:

```yaml
env:
  DEBUG_MODE: 'true'
```

### Cache Issues

If you're getting stale data, force regenerate:

```bash
# Manual trigger with force regenerate
# Go to Actions > Run workflow > Set "Force regenerate" to true
```

Or clear cache by adding this step to the workflow:

```yaml
- name: Clear Cache
  run: rm -rf ${{ env.DATA_DIR }}/cache/*
```

## 📈 Monitoring and Analytics

### Workflow Metrics

Each run provides detailed metrics:
- **Pain Points Extracted**: Number of issues found on Reddit
- **Checklists Generated**: PDF/text files created
- **Insights Generated**: Actionable recommendations produced
- **Files Committed**: Whether changes were saved to repository

### Performance Optimization

The workflow includes several performance optimizations:

1. **Dependency Caching**: Python packages and Node modules are cached
2. **Data Caching**: Reddit data is cached for 6 hours to avoid redundant API calls
3. **Retry Logic**: Failed API calls are retried with exponential backoff
4. **Parallel Processing**: Multiple steps can run concurrently where possible

### Error Recovery

The workflow is designed to handle partial failures gracefully:

- **Reddit API Fails**: Uses mock data to continue workflow
- **PDF Generation Fails**: Falls back to text format checklists
- **Analysis Fails**: Skips messaging update but preserves other outputs
- **Commit Fails**: Retries push operation up to 3 times

## 🔒 Security Considerations

### Secrets Management
- Never commit API credentials to the repository
- Use GitHub Secrets for all sensitive configuration
- Rotate API keys regularly

### Rate Limiting
- Respects Reddit's API rate limits (60 requests/minute)
- Implements exponential backoff for failed requests
- Includes request timeout protection

### File Validation
- Validates file names to prevent directory traversal
- Limits file sizes to prevent disk space issues
- Sanitizes user input in feedback data

## 🚀 Advanced Configuration

### Custom Analysis Rules

To add custom pain point categories, edit `scripts/analyze_feedback.py`:

```python
self.pain_point_categories = {
    'automation': ['automation', 'manual', 'repetitive'],
    'your_category': ['your', 'keywords', 'here'],
    # Add more categories...
}
```

### Custom Checklist Templates

To add new checklist templates, edit `scripts/generate_checklists.py`:

```python
self.checklist_templates = {
    'your_category': {
        'title': 'Your Custom Checklist',
        'subtitle': 'Solve Your Specific Problem',
        'intro': 'Your introduction text...',
        'items': [
            'Your actionable item 1',
            'Your actionable item 2',
            # Add more items...
        ]
    }
}
```

### Webhook Customization

For custom notification formats, modify the notification steps:

```yaml
- name: Custom Notification
  run: |
    # Your custom notification logic
    curl -X POST "your-webhook-url" \
      -H "Content-Type: application/json" \
      -d '{"text": "Custom message format"}'
```

## 📝 Contributing

To improve the automation system:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-improvement`
3. Test changes thoroughly with manual workflow runs
4. Submit a pull request with detailed description

### Testing Changes

Before deploying changes:

1. Test individual scripts locally:
   ```bash
   python scripts/fetch_reddit_feedback.py --keywords "test" --limit 5
   python scripts/generate_checklists.py --input data/test_data.json
   ```

2. Run a manual workflow with test parameters
3. Verify all notification channels receive messages correctly
4. Check that generated files are valid and properly formatted

---

**Need help?** Open an issue in the repository with detailed error messages and workflow run logs.