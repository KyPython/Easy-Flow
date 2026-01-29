#!/bin/bash
# Validate AI knowledge base parity with backend
set -e
KB_FILE="data/ai-workflow-knowledge.json"
if [ ! -f "$KB_FILE" ]; then
  echo "AI knowledge file not found: $KB_FILE" >&2
  exit 0
fi
# Extract task types from backend by grepping known fields
BACKEND_DIR="rpa-system/backend"
TMP_TASKS=$(mktemp)
TMP_ENDPOINTS=$(mktemp)
trap "rm -f $TMP_TASKS $TMP_ENDPOINTS" EXIT
# Task types seen in automation code
grep -RniE "task_type\s*[:=]|accepted_types" "$BACKEND_DIR" | sed -E 's/.*(web_automation|form_submission|data_extraction|file_download|invoice_download).*/\1/;' | sort -u | grep -E '^[a-z_]+' > "$TMP_TASKS" || true
# Endpoints
grep -RniE "app\.(post|get|delete)\s*\(\s*'/api/[^\\\"]+" "$BACKEND_DIR" | sed -E "s/.*('/api/[a-zA-Z0-9_:\/-]+)'.*/\1/" | sort -u > "$TMP_ENDPOINTS" || true
KB_TASKS=$(jq -r '.supported_task_types[]' "$KB_FILE" 2>/dev/null || true)
KB_ENDPOINTS=$(jq -r '.supported_endpoints[]' "$KB_FILE" 2>/dev/null || true)
MISSING_TASKS=()
EXTRA_TASKS=()
MISSING_ENDPOINTS=()
EXTRA_ENDPOINTS=()
# Compare tasks
for t in $KB_TASKS; do
  if ! grep -q "^$t$" "$TMP_TASKS"; then MISSING_TASKS+=("$t"); fi
done
while read -r bt; do
  [ -z "$bt" ] && continue
  echo "$KB_TASKS" | grep -q "^$bt$" || EXTRA_TASKS+=("$bt")
done < "$TMP_TASKS"
# Compare endpoints (normalize :id to {param})
normalize() { echo "$1" | sed 's/:[a-zA-Z0-9_\-]\+/{param}/g'; }
for e in $KB_ENDPOINTS; do
  ne=$(normalize "$e")
  if ! awk '{print}' "$TMP_ENDPOINTS" | sed 's/:[a-zA-Z0-9_\-]\+/{param}/g' | grep -q "^$ne$"; then MISSING_ENDPOINTS+=("$e"); fi
done
while read -r be; do
  ne=$(echo "$be" | sed 's/:[a-zA-Z0-9_\-]\+/{param}/g')
  found=0
  for ke in $KB_ENDPOINTS; do
    nke=$(normalize "$ke")
    if [ "$ne" = "$nke" ]; then found=1; break; fi
  done
  [ $found -eq 0 ] && EXTRA_ENDPOINTS+=("$be")
done < "$TMP_ENDPOINTS"
# Output summary and choose exit code by STRICT_MODE
STRICT_MODE=${STRICT_MODE:-false}
warn() { echo "WARNING: $1"; }
err() { echo "ERROR: $1"; }
if [ ${#MISSING_TASKS[@]} -gt 0 ]; then warn "Missing tasks in backend: ${MISSING_TASKS[*]}"; fi
if [ ${#EXTRA_TASKS[@]} -gt 0 ]; then warn "Backend has extra tasks not in KB: ${EXTRA_TASKS[*]}"; fi
if [ ${#MISSING_ENDPOINTS[@]} -gt 0 ]; then warn "Missing endpoints in backend: ${MISSING_ENDPOINTS[*]}"; fi
if [ ${#EXTRA_ENDPOINTS[@]} -gt 0 ]; then warn "Backend has extra endpoints not in KB: ${EXTRA_ENDPOINTS[*]}"; fi
if [ "$STRICT_MODE" = "true" ]; then
  if [ ${#MISSING_TASKS[@]} -gt 0 ] || [ ${#MISSING_ENDPOINTS[@]} -gt 0 ] || [ ${#EXTRA_TASKS[@]} -gt 0 ] || [ ${#EXTRA_ENDPOINTS[@]} -gt 0 ]; then
    err "AI knowledge parity failed in strict mode"
    exit 1
  fi
fi
exit 0
