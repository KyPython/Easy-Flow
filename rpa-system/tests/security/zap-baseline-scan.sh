#!/bin/bash

# OWASP ZAP Baseline Security Scan for EasyFlow
# This script runs a baseline security scan against the staging environment

set -e

TARGET_URL="${TARGET_URL:-http://backend:3030}"
REPORT_DIR="/zap/wrk"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔒 Starting OWASP ZAP Baseline Scan"
echo "Target: $TARGET_URL"
echo "Report Directory: $REPORT_DIR"
echo "Timestamp: $TIMESTAMP"

# Create reports directory if it doesn't exist
mkdir -p "$REPORT_DIR/reports"

# Run ZAP baseline scan
echo "🚀 Running baseline scan..."

zap-baseline.py \
    -t "$TARGET_URL" \
    -g gen.conf \
    -r "baseline_report_${TIMESTAMP}.html" \
    -x "baseline_report_${TIMESTAMP}.xml" \
    -J "baseline_report_${TIMESTAMP}.json" \
    -a \
    -d \
    -P "zap_progress_${TIMESTAMP}.log" \
    -w "baseline_report_${TIMESTAMP}.md" \
    -c "zap_rules.conf" \
    --hook=/zap/auth_hook.py \
    -z "-config api.disablekey=true" || true

# Move reports to reports directory
mv baseline_report_* "$REPORT_DIR/reports/" 2>/dev/null || true
mv zap_progress_* "$REPORT_DIR/reports/" 2>/dev/null || true

echo "✅ Baseline scan completed"
echo "📊 Reports available in: $REPORT_DIR/reports/"

# List generated reports
echo "📋 Generated reports:"
ls -la "$REPORT_DIR/reports/" | grep "baseline_report_${TIMESTAMP}"

echo "🔍 Scan summary:"
if [ -f "$REPORT_DIR/reports/baseline_report_${TIMESTAMP}.json" ]; then
    # Extract key metrics from JSON report if jq is available
    if command -v jq >/dev/null 2>&1; then
        echo "High Risk Alerts: $(jq '.site[0].alerts | map(select(.riskdesc | startswith("High"))) | length' "$REPORT_DIR/reports/baseline_report_${TIMESTAMP}.json")"
        echo "Medium Risk Alerts: $(jq '.site[0].alerts | map(select(.riskdesc | startswith("Medium"))) | length' "$REPORT_DIR/reports/baseline_report_${TIMESTAMP}.json")"
        echo "Low Risk Alerts: $(jq '.site[0].alerts | map(select(.riskdesc | startswith("Low"))) | length' "$REPORT_DIR/reports/baseline_report_${TIMESTAMP}.json")"
    fi
fi

echo "🎉 Security scan completed successfully!"