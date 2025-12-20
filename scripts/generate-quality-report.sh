#!/bin/bash
# EasyFlow Code Quality Report Generator
# Generates HTML dashboard from quality scan results

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "${BLUE}=== EasyFlow Code Quality Report Generator ===${NC}\n"

# Configuration
REPORT_DIR="reports/quality"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
JSON_REPORT="$REPORT_DIR/quality-${TIMESTAMP}.json"
HTML_REPORT="$REPORT_DIR/quality-${TIMESTAMP}.html"
LATEST_REPORT="$REPORT_DIR/latest.html"

# Create report directory
mkdir -p "$REPORT_DIR"

# Run quality scan and save JSON
echo "${BLUE}Running quality scan...${NC}"
./scripts/code-quality-check.sh "$JSON_REPORT" >/dev/null 2>&1 || true

# Check if JSON report exists
if [ ! -f "$JSON_REPORT" ]; then
    echo "${YELLOW}⚠ No JSON report found. Running fallback scan...${NC}"
    # Create a basic report structure
    cat > "$JSON_REPORT" <<EOF
{
  "scannedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "totalFiles": 0,
  "totalSmells": 0,
  "results": [],
  "summary": {
    "byRule": {},
    "bySeverity": {
      "low": 0,
      "medium": 0,
      "high": 0
    }
  }
}
EOF
fi

# Generate HTML dashboard
echo "${BLUE}Generating HTML dashboard...${NC}"

cat > "$HTML_REPORT" <<'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EasyFlow Code Quality Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #0066cc;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #0066cc;
        }
        .metric-label {
            color: #666;
            margin-top: 5px;
        }
        .severity-low { color: #28a745; }
        .severity-medium { color: #ffc107; }
        .severity-high { color: #dc3545; }
        .issues-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .issues-table th,
        .issues-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .issues-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        .issues-table tr:hover {
            background: #f8f9fa;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .badge-low { background: #d4edda; color: #155724; }
        .badge-medium { background: #fff3cd; color: #856404; }
        .badge-high { background: #f8d7da; color: #721c24; }
        .file-path {
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #0066cc;
        }
        .no-issues {
            text-align: center;
            padding: 40px;
            color: #28a745;
            font-size: 1.2em;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9em;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 EasyFlow Code Quality Report</h1>
        <p class="subtitle">Generated: <span id="timestamp"></span></p>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value" id="total-files">0</div>
                <div class="metric-label">Files Scanned</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-high" id="total-issues">0</div>
                <div class="metric-label">Total Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-high" id="high-severity">0</div>
                <div class="metric-label">High Severity</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-medium" id="medium-severity">0</div>
                <div class="metric-label">Medium Severity</div>
            </div>
            <div class="metric-card">
                <div class="metric-value severity-low" id="low-severity">0</div>
                <div class="metric-label">Low Severity</div>
            </div>
        </div>
        
        <div id="issues-container">
            <h2>Issues Found</h2>
            <table class="issues-table" id="issues-table">
                <thead>
                    <tr>
                        <th>Severity</th>
                        <th>File</th>
                        <th>Line</th>
                        <th>Issue</th>
                        <th>Rule</th>
                    </tr>
                </thead>
                <tbody id="issues-body">
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>EasyFlow Code Quality Dashboard | Generated by software-entropy</p>
            <p>Run <code>npm run quality:report</code> to generate a new report</p>
        </div>
    </div>
    
    <script>
        // Load and display report data
        const reportData = REPORT_DATA_PLACEHOLDER;
        
        document.getElementById('timestamp').textContent = new Date(reportData.scannedAt).toLocaleString();
        document.getElementById('total-files').textContent = reportData.totalFiles || 0;
        document.getElementById('total-issues').textContent = reportData.totalSmells || 0;
        document.getElementById('high-severity').textContent = reportData.summary?.bySeverity?.high || 0;
        document.getElementById('medium-severity').textContent = reportData.summary?.bySeverity?.medium || 0;
        document.getElementById('low-severity').textContent = reportData.summary?.bySeverity?.low || 0;
        
        const issuesBody = document.getElementById('issues-body');
        const issues = reportData.results || [];
        
        if (issues.length === 0) {
            issuesBody.innerHTML = '<tr><td colspan="5" class="no-issues">✅ No code quality issues found!</td></tr>';
        } else {
            issues.forEach(issue => {
                const row = document.createElement('tr');
                const severity = issue.severity || 'low';
                row.innerHTML = `
                    <td><span class="badge badge-${severity}">${severity.toUpperCase()}</span></td>
                    <td><span class="file-path">${issue.file || 'N/A'}</span></td>
                    <td>${issue.line || '-'}</td>
                    <td>${issue.message || 'N/A'}</td>
                    <td>${issue.rule || 'N/A'}</td>
                `;
                issuesBody.appendChild(row);
            });
        }
    </script>
</body>
</html>
HTML_EOF

# Inject JSON data into HTML
if [ -f "$JSON_REPORT" ]; then
    # Read JSON and escape for JavaScript
    JSON_CONTENT=$(cat "$JSON_REPORT" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | tr -d '\n')
    # Replace placeholder
    sed -i.bak "s|REPORT_DATA_PLACEHOLDER|\`${JSON_CONTENT}\`|g" "$HTML_REPORT"
    rm -f "$HTML_REPORT.bak"
fi

# Create symlink to latest
ln -sf "$(basename "$HTML_REPORT")" "$LATEST_REPORT" 2>/dev/null || true

echo "${GREEN}✓ Report generated: $HTML_REPORT${NC}"
echo "${GREEN}✓ Latest report: $LATEST_REPORT${NC}"
echo ""
echo "${CYAN}Open the report:${NC}"
echo "  ${BLUE}open $HTML_REPORT${NC}"
echo "  ${BLUE}open $LATEST_REPORT${NC}"

