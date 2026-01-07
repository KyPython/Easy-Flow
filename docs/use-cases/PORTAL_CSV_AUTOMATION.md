# Portal CSV Automation: The "Robot Intern" Use Case

## Overview

EasyFlow serves as your **"robot intern"** that automates the manual portal login and CSV export workflow, delivering clean, standardized files to your Python/DuckDB/BI stack automatically.

## The Problem

Data teams spend significant time:
- Logging into multiple vendor/client portals weekly
- Navigating complex report pages
- Setting date ranges and filters
- Clicking export/download buttons
- Organizing CSV files in scattered locations
- Remembering when each export needs to run

## The EasyFlow Solution

EasyFlow eliminates the entire **"log in + export"** layer, enabling your existing tools to work with always-up-to-date CSV files.

---

## Use Case Flow

### 1. Replace Manual Portal Logins

**What EasyFlow Does:**
- Runs a headless browser that logs into each portal with stored credentials
- Navigates to the exact report page (including filters/date ranges)
- Clicks "export CSV" / "download" buttons, even on JS-heavy pages

**How to Set Up:**
1. Create a workflow in EasyFlow's visual builder
2. Add "Web Scraping" step with login credentials
3. Configure navigation steps (click buttons, fill forms, select date ranges)
4. Add file download step to capture CSV

**Example Workflow:**
```
Start → Login to Portal → Navigate to Reports → Set Date Range → Click Export → Download CSV → Upload to Storage → End
```

### 2. Standardize CSV Landing Locations

**Destination Options:**

#### Option A: Local Server/VM
- EasyFlow downloads CSV to a watched folder
- Your Python scripts monitor the folder for new files
- DuckDB processes files from the same path

**Configuration:**
```json
{
  "step_type": "action",
  "action_type": "file_upload",
  "config": {
    "destination": "/data/imports/vendor-portal/",
    "naming_pattern": "{vendor}_{date}_{timestamp}.csv"
  }
}
```

#### Option B: Cloud Storage (S3/Drive)
- EasyFlow uploads CSV directly to S3/Google Drive bucket
- Accessible via API or webhook
- Your scripts read from cloud storage

**Configuration:**
```json
{
  "step_type": "action",
  "action_type": "file_upload",
  "config": {
    "destination": "s3://data-imports/vendor-portal/",
    "bucket": "easyflow-imports"
  }
}
```

#### Option C: Google Sheets / Landing Table
- EasyFlow writes CSV data directly to Google Sheets
- Or inserts into a database landing table
- No file management needed

**Configuration:**
```json
{
  "step_type": "action",
  "action_type": "sheets",
  "config": {
    "spreadsheet_id": "your-sheet-id",
    "worksheet": "Imports",
    "append": true
  }
}
```

### 3. Schedule Everything Automatically

**EasyFlow Scheduling:**
- Runs workflows on schedule (daily, weekly, hourly)
- Automatically retries if portal is slow or fails
- Sends notifications (Slack/email) on failures

**Setup:**
```javascript
// Create schedule via API
POST /api/workflows/{id}/schedules
{
  "schedule_type": "daily",
  "schedule_config": {
    "time": "02:00",
    "timezone": "America/New_York"
  },
  "notification_config": {
    "on_failure": ["slack", "email"],
    "recipients": ["team@company.com"]
  }
}
```

**Your Python/DuckDB Job:**
```python
# Your script just checks for new files
import glob
import duckdb

# Run after EasyFlow job (or on separate cron)
csv_files = glob.glob("/data/imports/vendor-portal/*.csv")
for file in csv_files:
    df = duckdb.read_csv(file)
    # Process and load into your DWH
```

### 4. Feed Dashboards & AI Tools

**Once CSVs are fresh:**
- Python/DuckDB scripts normalize and join data
- BI tools (Power BI, Looker Studio, Metabase) read cleaned tables
- AI-on-CSV tools analyze data automatically
- No one needs to remember logins, filters, or export buttons

---

## Implementation Details

### File Storage Architecture

EasyFlow stores downloaded files in:
- **Supabase Storage**: Primary storage for all artifacts
- **Local Filesystem**: Optionally for server-based workflows
- **Cloud Storage**: Direct integration with S3/Drive

### CSV Download Capabilities

**Supported Methods:**
1. **Direct Download**: Click export button → browser downloads CSV
2. **API Export**: Call portal's export API endpoint
3. **Table Scraping**: Extract table data → convert to CSV
4. **File Parsing**: Parse HTML tables → generate CSV

**File Handling:**
- Automatic file naming with timestamps
- Deduplication via SHA-256 checksums
- Metadata storage (source, date, size, mime type)
- Versioning for historical exports

### Schedule Management

**Schedule Types:**
- **One-time**: Run once at specific time
- **Daily**: Run at same time every day
- **Weekly**: Run on specific day(s) of week
- **Monthly**: Run on specific day of month
- **Custom Cron**: Advanced scheduling expressions

**Execution Modes:**
- **Realtime**: Execute immediately (user-triggered)
- **Balanced**: Standard scheduling (default)
- **Cost Optimized**: Batch during off-peak hours

### Retry & Error Handling

**Automatic Retries:**
- Retries up to 3 times on failure
- Exponential backoff between retries
- Detects transient errors (timeouts, network issues)
- Logs all retry attempts for debugging

**Failure Notifications:**
- Slack notifications with error details
- Email alerts to configured recipients
- Webhook callbacks to your systems
- Execution logs available in dashboard

---

## Example Workflows

### Example 1: Daily Vendor Portal Export

**Workflow Steps:**
1. **Start** → Initialize workflow
2. **Web Scraping** → Login to vendor portal (credentials stored securely)
3. **Action** → Navigate to "Reports" section
4. **Action** → Select date range (yesterday's date)
5. **Action** → Click "Export CSV" button
6. **File Upload** → Save to `/data/imports/vendor-portal/`
7. **End** → Complete

**Schedule:**
- Runs daily at 2:00 AM
- Sends Slack notification on failure
- Retries automatically if portal is slow

**Result:**
- CSV file appears in watched folder every morning
- Your Python script processes it at 3:00 AM
- Dashboard updates automatically

### Example 2: Weekly Multi-Portal Aggregation

**Workflow Steps:**
1. **Start** → Initialize
2. **Loop** → For each portal in list:
   - Login to portal
   - Export weekly report
   - Upload to S3 bucket
3. **Action** → Trigger webhook to notify Python job
4. **End** → Complete

**Schedule:**
- Runs every Monday at 1:00 AM
- Processes all portals sequentially
- Aggregates all CSVs into one S3 bucket

**Result:**
- All portal exports completed by 2:00 AM
- Python job triggered via webhook
- DuckDB processes all CSVs together

### Example 3: Real-time CSV Processing

**Workflow Steps:**
1. **Start** → Initialize
2. **Web Scraping** → Login and export CSV
3. **Google Sheets** → Append data to landing sheet
4. **End** → Complete

**Trigger:**
- Manual execution via API
- Or triggered by external webhook

**Result:**
- CSV data immediately available in Google Sheets
- BI tool connected to sheet updates in real-time

---

## Integration Patterns

### Pattern 1: File-Based Integration

```
EasyFlow → Download CSV → Local/Cloud Storage → Python Script → DuckDB → Dashboard
```

**Advantages:**
- Simple file-based interface
- No API dependencies
- Works with any downstream tool

### Pattern 2: Database Integration

```
EasyFlow → Download CSV → Parse & Insert → Landing Table → ETL Pipeline → Data Warehouse
```

**Advantages:**
- Centralized data storage
- Better data validation
- Transactional consistency

### Pattern 3: API/Webhook Integration

```
EasyFlow → Download CSV → Upload to S3 → Webhook → Python Script → Process → Notify
```

**Advantages:**
- Real-time processing
- Event-driven architecture
- Better error handling

---

## Security & Credentials

**Credential Storage:**
- Encrypted storage in Supabase
- Per-workflow credential isolation
- Support for OAuth flows
- API key management

**Access Control:**
- User-level workflow permissions
- Team-level sharing
- Audit logs for all accesses

---

## Cost Optimization

**Execution Modes:**
- **Eco Mode**: Batch scheduled exports during off-peak hours
- **Balanced Mode**: Standard scheduling
- **Realtime Mode**: Immediate execution (higher cost)

**Smart Scheduling:**
- Automatically batches multiple portal exports
- Optimizes execution times to reduce costs
- Estimates cost before execution

---

## Monitoring & Observability

**Execution Monitoring:**
- Real-time execution status
- Success/failure rates
- Execution duration metrics
- File download statistics

**Alerting:**
- Failed exports → Slack/Email
- Portal login failures → Immediate notification
- File processing errors → Alert downstream systems

**Analytics:**
- Portal availability tracking
- Export success rates
- Processing times (P50, P95, P99)
- Cost per export

---

## Setup Checklist

- [ ] Create EasyFlow account
- [ ] Configure portal credentials (one-time setup)
- [ ] Build workflow for each portal (visual builder)
- [ ] Configure destination (folder/S3/Sheets)
- [ ] Set up schedule (daily/weekly)
- [ ] Configure notifications (Slack/Email)
- [ ] Test workflow manually
- [ ] Enable schedule
- [ ] Set up Python/DuckDB script to watch destination
- [ ] Verify first automated run
- [ ] Connect BI tool to processed data

---

## Benefits Summary

✅ **Eliminates Manual Work**: No more weekly portal logins  
✅ **Standardized Output**: Consistent file locations and naming  
✅ **Reliable Scheduling**: Never miss an export  
✅ **Automatic Retries**: Handles portal slowness/failures  
✅ **Notifications**: Know immediately if something fails  
✅ **Cost Effective**: Batch processing during off-peak hours  
✅ **Scalable**: Handle hundreds of portals  
✅ **Observable**: Full visibility into execution metrics  

---

## Related Documentation

- [Workflow Builder Guide](../guides/workflow-builder.md)
- [Scheduling Documentation](../guides/scheduling.md)
- [File Management Guide](../guides/file-management.md)
- [Integration Patterns](../guides/integration-patterns.md)

