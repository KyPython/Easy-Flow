#!/bin/bash
# Export Code Quality Metrics to Prometheus Format
# This script runs code quality checks and exports metrics to a Prometheus-compatible endpoint

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

METRICS_FILE="/tmp/easyflow-code-quality-metrics.prom"
REPORT_FILE="/tmp/easyflow-code-quality-report.json"

echo "${BLUE}=== Exporting Code Quality Metrics ===${NC}"

# Run quality check and save JSON report
./scripts/code-quality-check.sh "$REPORT_FILE" >/dev/null 2>&1 || true

# Check if report exists
if [ ! -f "$REPORT_FILE" ]; then
    echo "${YELLOW}⚠ No quality report found, creating empty metrics${NC}"
    cat > "$METRICS_FILE" <<EOF
# HELP easyflow_code_quality_total_files Total number of files scanned
# TYPE easyflow_code_quality_total_files gauge
easyflow_code_quality_total_files 0
# HELP easyflow_code_quality_total_issues Total number of code quality issues
# TYPE easyflow_code_quality_total_issues gauge
easyflow_code_quality_total_issues 0
# HELP easyflow_code_quality_issues_by_severity Code quality issues by severity
# TYPE easyflow_code_quality_issues_by_severity gauge
easyflow_code_quality_issues_by_severity{severity="high"} 0
easyflow_code_quality_issues_by_severity{severity="medium"} 0
easyflow_code_quality_issues_by_severity{severity="low"} 0
# HELP easyflow_code_quality_last_scan Timestamp of last quality scan
# TYPE easyflow_code_quality_last_scan gauge
easyflow_code_quality_last_scan $(date +%s)
EOF
    exit 0
fi

# Parse JSON report and generate Prometheus metrics
TOTAL_FILES=$(jq -r '.totalFiles // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
TOTAL_ISSUES=$(jq -r '.totalSmells // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
HIGH_ISSUES=$(jq -r '.summary.bySeverity.high // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
MEDIUM_ISSUES=$(jq -r '.summary.bySeverity.medium // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
LOW_ISSUES=$(jq -r '.summary.bySeverity.low // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
LAST_SCAN=$(date +%s)

# Generate Prometheus format metrics
cat > "$METRICS_FILE" <<EOF
# HELP easyflow_code_quality_total_files Total number of files scanned
# TYPE easyflow_code_quality_total_files gauge
easyflow_code_quality_total_files ${TOTAL_FILES}
# HELP easyflow_code_quality_total_issues Total number of code quality issues
# TYPE easyflow_code_quality_total_issues gauge
easyflow_code_quality_total_issues ${TOTAL_ISSUES}
# HELP easyflow_code_quality_issues_by_severity Code quality issues by severity
# TYPE easyflow_code_quality_issues_by_severity gauge
easyflow_code_quality_issues_by_severity{severity="high"} ${HIGH_ISSUES}
easyflow_code_quality_issues_by_severity{severity="medium"} ${MEDIUM_ISSUES}
easyflow_code_quality_issues_by_severity{severity="low"} ${LOW_ISSUES}
# HELP easyflow_code_quality_last_scan Timestamp of last quality scan
# TYPE easyflow_code_quality_last_scan gauge
easyflow_code_quality_last_scan ${LAST_SCAN}
EOF

echo "${GREEN}✓ Metrics exported to $METRICS_FILE${NC}"
echo "${BLUE}  Total files: ${TOTAL_FILES}${NC}"
echo "${BLUE}  Total issues: ${TOTAL_ISSUES} (High: ${HIGH_ISSUES}, Medium: ${MEDIUM_ISSUES}, Low: ${LOW_ISSUES})${NC}"

